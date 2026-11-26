"""Parse an extracted document into structured test results."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Sequence

from medical_report.config import Settings, get_settings
from medical_report.parsing import classify, names, ranges, report_type, rows, units, values
from medical_report.parsing.types import (
    CATEGORY_LABELS,
    STATUS_NEEDS_REVIEW,
    Correction,
    ParsedReport,
    ParsedTestResult,
    SourceRef,
    Verification,
)
from medical_report.pipeline.extract import extract_document
from medical_report.pipeline.types import DocumentResult, PageResult

MAX_UNPARSED_LINES = 200


def _is_noise(text: str) -> bool:
    stripped = (text or "").strip()
    if len(stripped) < 3:
        return True
    if not any(char.isalnum() for char in stripped):
        return True
    visible = {char for char in stripped if not char.isspace()}
    return bool(visible) and visible <= set("-=_*.~|:")


def _looks_like_data(text: str) -> bool:
    stripped = (text or "").strip()
    return len(stripped) >= 6 and any(char.isdigit() for char in stripped)


def _confidence(
    match_score: float,
    matched: bool,
    value_kind: str,
    unit_known: bool,
    has_range: bool,
    page_source: str,
    line_confidence: Optional[float],
    verification: Verification,
) -> float:
    score = 55.0
    score += 25.0 * min(max(match_score, 0.0), 1.0)
    if not matched:
        score -= 15.0
    if value_kind in ("numeric", "qualitative"):
        score += 8.0
    else:
        score -= 25.0
    if unit_known:
        score += 5.0
    elif value_kind == "numeric":
        score -= 5.0
    if has_range:
        score += 5.0
    if page_source == "ocr":
        observed = line_confidence if line_confidence is not None else 0.0
        score -= max(0.0, (75.0 - observed) * 0.4)
    if verification.agreement == "match":
        score += 5.0
    elif verification.agreement == "mismatch":
        score = min(score, 45.0)
    return round(min(max(score, 5.0), 98.0), 1)


def _build_test(
    raw: rows.RawRow,
    page: PageResult,
    section: Optional[str],
    index: int,
    verifier,
) -> Optional[ParsedTestResult]:
    match = names.match(raw.name_text, section)
    parsed_value = values.parse_value(raw.value_text)
    unit_match = units.normalize_unit(raw.unit_text)
    reference = ranges.parse(raw.range_text)
    flag = classify.normalize_flag(raw.flag_text)

    # A row needs a recognised test name or real structure (known unit / range).
    has_structure = raw.range_text is not None or unit_match.known
    if match.definition is None and not has_structure:
        return None

    category = match.definition.category if match.definition is not None else (section or "other")

    verification = Verification()
    if (
        verifier is not None
        and page.source == "ocr"
        and parsed_value.kind == "numeric"
        and raw.value_bbox is not None
    ):
        verification = verifier(page, raw.value_bbox, parsed_value.raw or "")

    classification = classify.classify(parsed_value, reference, flag, match.definition)
    review: List[str] = list(classification.review_reasons)
    status = classification.status

    if match.method == "ambiguous":
        review.append("ambiguous_test_name")
    elif match.method == "unknown":
        review.append("unknown_test_name")

    if verification.agreement == "mismatch":
        review.append("english_ocr_disagrees")
        status = STATUS_NEEDS_REVIEW

    if parsed_value.kind == "numeric" and raw.unit_text and not unit_match.known:
        review.append("unrecognized_unit")

    if status == STATUS_NEEDS_REVIEW and not review:
        review.append("classification_requires_review")

    return ParsedTestResult(
        index=index,
        canonical_id=match.definition.id if match.definition else None,
        canonical_name=names.display_name(raw.name_text, match.definition),
        category=category,
        name_raw=raw.name_text,
        name_normalized=match.normalized,
        name_match_method=match.method,
        name_match_score=match.score,
        extracted_value_raw=parsed_value.raw,
        extracted_value_numeric=parsed_value.numeric,
        extracted_unit_raw=raw.unit_text,
        extracted_reference_text=raw.range_text,
        value_raw=parsed_value.raw,
        value_numeric=parsed_value.numeric,
        value_qualitative=parsed_value.qualitative,
        unit_raw=unit_match.raw or None,
        unit_normalized=unit_match.normalized or None,
        unit_known=unit_match.known,
        reference=reference,
        lab_flag_raw=raw.flag_text,
        status=status,
        status_basis=classification.basis,
        status_reason=classification.reason,
        confidence=_confidence(
            match.score,
            match.definition is not None,
            parsed_value.kind,
            unit_match.known,
            reference.present,
            page.source,
            raw.line_confidence,
            verification,
        ),
        needs_review=bool(review),
        review_reasons=review,
        verification=verification,
        source=SourceRef(
            page_index=page.index,
            line_index=raw.line_index,
            row_index=raw.key[2],
            page_source=page.source,
            bbox=raw.value_bbox or raw.bbox,
        ),
    )


def parse_document(
    document: DocumentResult,
    settings: Optional[Settings] = None,
    verifier=None,
) -> ParsedReport:
    """Parse one extracted document. ``verifier`` enables numeric cross-checks."""
    started = time.perf_counter()
    settings = settings or get_settings()

    tests: List[ParsedTestResult] = []
    unparsed: List[Dict[str, Any]] = []
    header_events: List[Dict[str, Any]] = []

    for page in document.pages:
        section: Optional[str] = None
        for line_index, line in enumerate(page.lines):
            header = report_type.detect_section_header(line.text)
            if header:
                section = header
                header_events.append(
                    {
                        "page_index": page.index,
                        "line_index": line_index,
                        "category": header,
                        "text": line.text.strip()[:120],
                    }
                )
                continue

            if _is_noise(line.text):
                continue

            raw_rows = rows.parse_line(line, page.index, line_index)
            if not raw_rows:
                if _looks_like_data(line.text) and len(unparsed) < MAX_UNPARSED_LINES:
                    unparsed.append(
                        {
                            "page_index": page.index,
                            "line_index": line_index,
                            "text": line.text.strip()[:300],
                            "reason": "not_recognised_as_test_row",
                        }
                    )
                continue

            for raw in raw_rows:
                result = _build_test(raw, page, section, len(tests), verifier)
                if result is None:
                    if _looks_like_data(line.text) and len(unparsed) < MAX_UNPARSED_LINES:
                        unparsed.append(
                            {
                                "page_index": page.index,
                                "line_index": line_index,
                                "text": line.text.strip()[:300],
                                "reason": "row_without_recognisable_test",
                            }
                        )
                    continue
                tests.append(result)

    report_types = report_type.detect_report_types(tests, header_events)
    by_status: Dict[str, int] = {status: 0 for status in ("WITHIN_RANGE", "HIGH", "LOW", "ABNORMAL", "UNKNOWN", "NEEDS_REVIEW")}
    by_category: Dict[str, int] = {}
    for test in tests:
        by_status[test.status] = by_status.get(test.status, 0) + 1
        by_category[test.category] = by_category.get(test.category, 0) + 1

    warnings = list(document.warnings)
    if not tests:
        warnings.append("No test results could be parsed from this document.")

    stats: Dict[str, Any] = {
        "page_count": len(document.pages),
        "lines_scanned": sum(len(page.lines) for page in document.pages),
        "rows_found": len(tests) + len(unparsed),
        "tests": len(tests),
        "unparsed_lines": len(unparsed),
        "needs_review": sum(1 for test in tests if test.needs_review),
        "recognised_tests": sum(1 for test in tests if test.canonical_id),
        "by_status": by_status,
        "by_category": by_category,
        "duration_ms": round((time.perf_counter() - started) * 1000.0, 1),
        "extraction": document.stats,
    }

    return ParsedReport(
        document_id=document.document_id,
        report=report_types,
        tests=tests,
        unparsed_lines=unparsed,
        corrections=[],
        warnings=warnings,
        stats=stats,
    )


def parse_document_file(
    path: str,
    kind: str,
    settings: Optional[Settings] = None,
    *,
    languages: Optional[Sequence[str]] = None,
    dpi: Optional[int] = None,
    max_pages: Optional[int] = None,
    document_id: Optional[str] = None,
    cross_verify: bool = True,
) -> ParsedReport:
    """Extract a file, then parse it (with English cross-verification on OCR pages)."""
    settings = settings or get_settings()
    document = extract_document(
        path,
        kind,
        settings,
        languages=languages,
        dpi=dpi,
        max_pages=max_pages,
        document_id=document_id,
    )

    verifier = None
    try:
        if cross_verify and any(page.source == "ocr" for page in document.pages):
            from medical_report.parsing.verify import NumericVerifier

            verifier = NumericVerifier(path, kind, settings)
        report = parse_document(document, settings=settings, verifier=verifier)
    finally:
        if verifier is not None:
            verifier.close()

    return report
