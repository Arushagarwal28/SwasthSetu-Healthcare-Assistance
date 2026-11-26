"""Extraction orchestration.

Order of preference per PDF page:

1. native text layer (exact, no OCR error)
2. render at DPI -> preprocess -> Tesseract

No file content is logged and nothing is written outside the caller's temp file.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

import pdfplumber

from medical_report.config import Settings
from medical_report.errors import DocumentUnreadable, ExtractionError, OcrUnavailable, translate_pdf_error
from medical_report.pipeline import layout, pdf_text, preprocess, render
from medical_report.pipeline.ocr_engine import OcrEngine, get_engine, resolve_languages
from medical_report.pipeline.types import DocumentResult, PageResult, Word


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(value, maximum))


def _pdf_words(raw_words: Sequence[Dict[str, Any]]) -> List[Word]:
    words: List[Word] = []
    for raw in raw_words:
        text = (raw.get("text") or "").strip()
        if not text:
            continue
        words.append(
            Word(
                text=text,
                x0=float(raw["x0"]),
                x1=float(raw["x1"]),
                top=float(raw["top"]),
                bottom=float(raw["bottom"]),
                confidence=None,
            )
        )
    return words


def _page_text(lines: Sequence[layout.Line]) -> str:
    return "\n".join(line.text for line in lines if line.text)


def _digital_page(page, index: int, raw_words: Sequence[Dict[str, Any]]) -> PageResult:
    words = _pdf_words(raw_words)
    lines = layout.words_to_lines(words)

    warnings: List[str] = []
    if any(not bool(word.get("upright", True)) for word in raw_words):
        warnings.append("Some text on this page is rotated; extraction may be partial.")

    return PageResult(
        index=index,
        width=float(page.width),
        height=float(page.height),
        units="pt",
        source="pdf_text",
        languages=[],
        text=_page_text(lines),
        lines=lines,
        tables=pdf_text.extract_tables(page),
        word_count=len(words),
        rotation=int(getattr(page, "rotation", 0) or 0),
        preprocessing={"steps": ["native PDF text layer, OCR skipped"]},
        warnings=warnings,
    )


def _ocr_page(
    gray,
    *,
    index: int,
    width: float,
    height: float,
    units: str,
    settings: Settings,
    engine: OcrEngine,
    languages: Optional[Sequence[str]],
    dpi: Optional[int],
    rotation: int = 0,
    extra_meta: Optional[Dict[str, Any]] = None,
) -> PageResult:
    if not engine.is_available():
        raise OcrUnavailable(
            "This document needs OCR, but the OCR engine (Tesseract) is not installed on this server.",
            details={"page": index + 1},
        )

    prepared, prep_meta = preprocess.prepare_for_ocr(gray, settings)
    resolved_languages, language_meta = resolve_languages(prepared, engine, settings, languages)
    output = engine.recognize(
        prepared,
        languages=resolved_languages,
        psm=settings.psm,
        oem=settings.oem,
        timeout=settings.ocr_timeout_seconds,
        min_confidence=settings.min_confidence,
    )

    height_px, width_px = prepared.shape[:2]
    scale_x = width / float(width_px) if width_px else 1.0
    scale_y = height / float(height_px) if height_px else 1.0

    words: List[Word] = []
    for raw in output.words:
        text = raw.text.strip()
        if not text:
            continue
        words.append(
            Word(
                text=text,
                x0=raw.left * scale_x,
                x1=(raw.left + raw.width) * scale_x,
                top=raw.top * scale_y,
                bottom=(raw.top + raw.height) * scale_y,
                confidence=raw.confidence,
            )
        )

    lines = layout.words_to_lines(words)
    tables = layout.infer_tables(lines, x_tolerance=max(12.0, 0.02 * width))

    warnings: List[str] = []
    if not words:
        warnings.append("No readable text was found on this page.")
    elif output.mean_confidence < settings.low_confidence_page_threshold:
        warnings.append(f"Low OCR confidence ({output.mean_confidence:.1f}); text may contain errors.")

    meta: Dict[str, Any] = dict(prep_meta)
    meta.update(extra_meta or {})
    meta["language_selection"] = language_meta
    meta["ocr_ms"] = output.duration_ms
    meta["psm"] = output.psm

    return PageResult(
        index=index,
        width=width,
        height=height,
        units=units,
        source="ocr",
        languages=resolved_languages,
        text=_page_text(lines),
        lines=lines,
        tables=tables,
        word_count=len(words),
        mean_confidence=output.mean_confidence,
        low_confidence_word_ratio=round(output.low_confidence_ratio, 3),
        rotation=rotation,
        dpi=dpi,
        script=language_meta.get("script"),
        script_confidence=language_meta.get("script_confidence"),
        preprocessing=meta,
        warnings=warnings,
    )


def _extract_pdf(
    path: str,
    settings: Settings,
    engine: OcrEngine,
    languages: Optional[Sequence[str]],
    dpi: int,
    page_limit: int,
    warnings: List[str],
) -> Tuple[List[PageResult], int]:
    try:
        document = render.open_document(path)
    except Exception as exc:
        raise translate_pdf_error(exc) from exc

    try:
        total_pages = render.document_page_count(document)
        if total_pages == 0:
            raise DocumentUnreadable("The PDF contains no pages.")
        limit = min(total_pages, page_limit)
        if total_pages > limit:
            warnings.append(f"Document has {total_pages} pages; only the first {limit} were processed.")

        pages: List[PageResult] = []
        try:
            with pdfplumber.open(path) as pdf:
                plumber_pages = pdf.pages
                for index in range(min(limit, len(plumber_pages))):
                    page = plumber_pages[index]
                    digital, _reason, raw_words = pdf_text.analyse_digital_page(page, settings)
                    if digital:
                        pages.append(_digital_page(page, index, raw_words))
                        continue

                    gray, render_meta = render.render_page(document, index, dpi, settings.max_pixels)
                    pages.append(
                        _ocr_page(
                            gray,
                            index=index,
                            width=float(page.width),
                            height=float(page.height),
                            units="pt",
                            settings=settings,
                            engine=engine,
                            languages=languages,
                            dpi=render_meta.get("dpi"),
                            rotation=int(render_meta.get("rotation") or 0),
                            extra_meta={"render": render_meta},
                        )
                    )
        except ExtractionError:
            raise
        except Exception as exc:
            raise translate_pdf_error(exc) from exc
        return pages, total_pages
    finally:
        document.close()


def _extract_image(
    path: str,
    settings: Settings,
    engine: OcrEngine,
    languages: Optional[Sequence[str]],
    dpi: Optional[int],
) -> List[PageResult]:
    gray, meta = render.load_image(path, settings.max_pixels)
    width, height = render.image_page_size(gray)
    return [
        _ocr_page(
            gray,
            index=0,
            width=width,
            height=height,
            units="px",
            settings=settings,
            engine=engine,
            languages=languages,
            dpi=dpi,
            extra_meta={"render": meta},
        )
    ]


def _stats(pages: Sequence[PageResult], total_pages: int, dpi: Optional[int], duration_ms: float) -> Dict[str, Any]:
    ocr_pages = [page for page in pages if page.source == "ocr"]
    with_confidence = [page for page in ocr_pages if page.mean_confidence is not None]
    word_weight = sum(page.word_count for page in with_confidence)

    weighted_confidence = None
    weighted_low_ratio = None
    if word_weight:
        weighted_confidence = round(
            sum((page.mean_confidence or 0.0) * page.word_count for page in with_confidence) / word_weight, 2
        )
        weighted_low_ratio = round(
            sum((page.low_confidence_word_ratio or 0.0) * page.word_count for page in with_confidence) / word_weight, 3
        )

    return {
        "page_count": total_pages,
        "processed_pages": len(pages),
        "digital_pages": sum(1 for page in pages if page.source == "pdf_text"),
        "ocr_pages": len(ocr_pages),
        "skipped_pages": max(total_pages - len(pages), 0),
        "word_count": sum(page.word_count for page in pages),
        "mean_confidence": weighted_confidence,
        "confidence_pages": len(with_confidence),
        "low_confidence_word_ratio": weighted_low_ratio,
        "dpi": dpi,
        "duration_ms": round(duration_ms, 1),
    }


def extract_document(
    path: str,
    kind: str,
    settings: Settings,
    *,
    languages: Optional[Sequence[str]] = None,
    dpi: Optional[int] = None,
    max_pages: Optional[int] = None,
    document_id: Optional[str] = None,
) -> DocumentResult:
    """Extract text, lines, tables and quality signals from one document."""
    started = time.perf_counter()
    engine = get_engine(settings)

    warnings: List[str] = []
    requested_pages = max_pages if max_pages and max_pages > 0 else settings.max_pages
    page_limit = _clamp(int(requested_pages), 1, settings.max_pages)
    if max_pages and max_pages > settings.max_pages:
        warnings.append(f"max_pages capped at the server limit of {settings.max_pages}.")

    if kind == "pdf":
        effective_dpi: Optional[int] = _clamp(int(dpi or settings.ocr_dpi), settings.min_dpi, settings.max_dpi)
        pages, total_pages = _extract_pdf(path, settings, engine, languages, effective_dpi, page_limit, warnings)
        units = "pt"
    elif kind == "image":
        effective_dpi = dpi
        pages = _extract_image(path, settings, engine, languages, dpi)
        total_pages = 1
        units = "px"
    else:
        raise DocumentUnreadable("Unsupported document kind.", details={"kind": kind})

    if total_pages > len(pages) and not any("page limit" in warning for warning in warnings):
        warnings.append(f"{total_pages - len(pages)} page(s) were skipped because of the page limit.")

    result = DocumentResult(
        document_id=document_id,
        kind=kind,
        units=units,
        engine=engine.describe(),
        pages=pages,
        warnings=warnings,
        stats=_stats(pages, total_pages, effective_dpi, (time.perf_counter() - started) * 1000.0),
    )

    low_pages = [
        page.index + 1
        for page in pages
        if page.source == "ocr"
        and page.mean_confidence is not None
        and page.mean_confidence < settings.low_confidence_page_threshold
    ]
    if low_pages:
        result.warnings.append(
            "Low OCR confidence on page(s) " + ", ".join(str(number) for number in low_pages) + "; review the text."
        )
    if any(page.source == "ocr" for page in pages):
        result.warnings.append("Text for scanned pages was produced by OCR and may contain recognition errors.")
    return result
