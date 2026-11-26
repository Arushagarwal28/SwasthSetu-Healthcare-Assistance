"""Digital (text-layer) PDF extraction: exact text, no OCR, no confidence."""

from __future__ import annotations

from medical_report.pipeline.extract import extract_document
from medical_report.testing import fixtures


def test_digital_pdf_uses_native_text_layer(tmp_path, settings):
    path = tmp_path / "digital.pdf"
    fixtures.build_text_pdf(path, [fixtures.report_lines()])

    result = extract_document(str(path), "pdf", settings)

    assert result.kind == "pdf"
    assert result.units == "pt"
    assert result.stats["page_count"] == 1
    assert result.stats["digital_pages"] == 1
    assert result.stats["ocr_pages"] == 0

    page = result.pages[0]
    assert page.source == "pdf_text"
    assert page.mean_confidence is None
    assert page.rotation == 0
    assert "Hemoglobin" in page.text
    assert "13.4" in page.text
    assert "SYNTHETIC" in page.text.upper()
    assert result.engine["name"] == "tesseract"


def test_digital_words_carry_no_confidence(tmp_path, settings):
    path = tmp_path / "digital.pdf"
    fixtures.build_text_pdf(path, [fixtures.report_lines()])

    page = extract_document(str(path), "pdf", settings).pages[0]

    confidences = [word.confidence for line in page.lines for cell in line.cells for word in cell]
    assert confidences, "expected at least one word"
    assert all(value is None for value in confidences)


def test_lines_and_cells_are_reconstructed(tmp_path, settings):
    path = tmp_path / "table.pdf"
    fixtures.build_table_pdf(path)

    page = extract_document(str(path), "pdf", settings).pages[0]

    assert page.lines[0].text.strip().startswith("CITY DIAGNOSTIC LABORATORY")
    wide_line = next(line for line in page.lines if "Hemoglobin" in line.text)
    assert len(wide_line.cells) >= 3, "result/unit/reference columns should split into cells"


def test_ruled_table_is_extracted(tmp_path, settings):
    path = tmp_path / "table.pdf"
    fixtures.build_table_pdf(path)

    page = extract_document(str(path), "pdf", settings).pages[0]

    assert page.source == "pdf_text"
    assert page.tables, "expected at least one detected table"
    table = page.tables[0]
    assert table.source == "pdf_text"
    assert table.confidence is None
    flattened = " ".join(cell for row in table.rows for cell in row)
    assert "Hemoglobin" in flattened
    assert "13.4" in flattened


def test_multi_page_digital_pdf_reports_every_page(tmp_path, settings):
    path = tmp_path / "three-pages.pdf"
    fixtures.build_text_pdf(
        path,
        [fixtures.report_lines(), fixtures.REPORT_BODY, fixtures.REPORT_BODY],
    )

    result = extract_document(str(path), "pdf", settings)

    assert len(result.pages) == 3
    assert result.stats["page_count"] == 3
    assert [page.index for page in result.pages] == [0, 1, 2]
    assert result.stats["skipped_pages"] == 0
