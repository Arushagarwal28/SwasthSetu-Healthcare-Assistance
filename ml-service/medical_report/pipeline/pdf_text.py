"""Native (digital) PDF text and table extraction.

A PDF page with a real text layer is always preferred over OCR: it is exact,
instant and free of recognition error. OCR only runs for pages that have no
usable text layer.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

from medical_report.config import Settings
from medical_report.pipeline.types import Table

#: Text shorter than this on an image-heavy page is treated as a scan overlay.
_STUB_TEXT_LIMIT = 120


def extract_words(page) -> List[Dict[str, Any]]:
    """Extract positioned words from a pdfplumber page."""
    try:
        return list(
            page.extract_words(
                x_tolerance=1.5,
                y_tolerance=2.0,
                keep_blank_chars=False,
                use_text_flow=False,
            )
        )
    except Exception:
        return []


def image_area_ratio(page) -> float:
    """Fraction of the page covered by embedded images."""
    try:
        page_area = float(page.width) * float(page.height)
        if page_area <= 0:
            return 0.0
        covered = 0.0
        for image in page.images:
            width = abs(float(image.get("x1", 0)) - float(image.get("x0", 0)))
            height = abs(float(image.get("bottom", 0)) - float(image.get("top", 0)))
            covered += width * height
        return min(covered / page_area, 1.0)
    except Exception:
        return 0.0


def analyse_digital_page(page, settings: Settings) -> Tuple[bool, str, List[Dict[str, Any]]]:
    """Decide whether a page carries a usable text layer."""
    words = extract_words(page)
    text_length = sum(len(word.get("text") or "") for word in words)

    if len(words) < settings.min_digital_words and text_length < settings.min_digital_chars:
        return False, "no usable text layer", words

    coverage = image_area_ratio(page)
    if coverage >= settings.image_dominance_ratio and text_length < _STUB_TEXT_LIMIT:
        return False, "page is dominated by a scanned image", words

    return True, "native PDF text layer", words


def extract_tables(page) -> List[Table]:
    """Structured tables, when the PDF draws them with rules."""
    tables: List[Table] = []
    try:
        found = list(page.find_tables())
    except Exception:
        return tables

    for found_table in found:
        try:
            raw_rows = found_table.extract()
        except Exception:
            continue
        rows: List[List[str]] = []
        for raw_row in raw_rows or []:
            if raw_row is None:
                continue
            row = ["" if cell is None else str(cell).strip() for cell in raw_row]
            if any(row):
                rows.append(row)
        if len(rows) < 2:
            continue
        bbox = getattr(found_table, "bbox", None) or (0, 0, 0, 0)
        tables.append(
            Table(
                rows=rows,
                columns=max(len(row) for row in rows),
                source="pdf_text",
                bbox={"x0": float(bbox[0]), "top": float(bbox[1]), "x1": float(bbox[2]), "bottom": float(bbox[3])},
                confidence=None,
            )
        )
    return tables
