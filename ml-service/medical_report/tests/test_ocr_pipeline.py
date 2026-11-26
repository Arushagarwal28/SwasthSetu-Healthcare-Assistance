"""OCR path: scanned images, scanned PDFs, skew, low contrast, page limits."""

from __future__ import annotations

import pytest

from medical_report.pipeline.evaluation import summarize, word_recall
from medical_report.pipeline.extract import extract_document
from medical_report.testing import fixtures

pytestmark = pytest.mark.ocr


def test_scanned_image_is_ocrd(tmp_path, settings, tesseract_ready):
    path = tmp_path / "scan.png"
    fixtures.render_text_image(fixtures.report_lines()).save(path)

    result = extract_document(str(path), "image", settings)
    page = result.pages[0]

    assert result.units == "px"
    assert page.source == "ocr"
    assert page.languages == ["eng"]
    assert page.mean_confidence is not None and page.mean_confidence > 60
    # A standalone image has no render DPI; only PDF pages do.
    assert page.dpi is None
    assert page.preprocessing["render"]["filename_suffix"] == ".png"

    scores = summarize(fixtures.report_text(), page.text)
    print(f"\nclean scan: recall={scores['recall']} cer={scores['cer']} conf={page.mean_confidence}")
    assert scores["recall"] >= 0.85, page.text
    assert scores["cer"] <= 0.12, page.text
    assert "Hemoglobin" in page.text
    assert "13.4" in page.text


def test_scanned_pdf_uses_ocr_path(tmp_path, settings, tesseract_ready):
    image = fixtures.render_a4_scan(fixtures.report_lines(), dpi=150)
    path = tmp_path / "scanned.pdf"
    fixtures.save_images_as_pdf([image], path, resolution=150)

    result = extract_document(str(path), "pdf", settings)
    page = result.pages[0]

    assert result.stats["ocr_pages"] == 1
    assert page.source == "ocr"
    assert page.units == "pt"
    assert page.width == pytest.approx(595.4, abs=2.0)
    assert page.height == pytest.approx(841.7, abs=2.0)
    assert page.dpi == settings.ocr_dpi
    assert word_recall(fixtures.report_text(), page.text) >= 0.8, page.text


def test_skewed_scan_is_deskewed(tmp_path, settings, tesseract_ready):
    path = tmp_path / "skewed.png"
    fixtures.render_text_image(fixtures.report_lines(), rotate=6.0).save(path)

    page = extract_document(str(path), "image", settings).pages[0]

    assert abs(page.preprocessing.get("skew_degrees", 0.0)) >= 1.0, page.preprocessing
    recall = word_recall(fixtures.report_text(), page.text)
    print(f"\nskewed scan: skew={page.preprocessing.get('skew_degrees')} recall={recall}")
    assert recall >= 0.7, page.text
    assert "Hemoglobin" in page.text


def test_low_contrast_scan_is_recovered(tmp_path, settings, tesseract_ready):
    path = tmp_path / "faint.png"
    fixtures.render_text_image(fixtures.REPORT_BODY, faint=True, font_size=30).save(path)

    page = extract_document(str(path), "image", settings).pages[0]

    assert any("CLAHE" in step for step in page.preprocessing["steps"]), page.preprocessing
    assert "Hemoglobin" in page.text
    assert word_recall(fixtures.REPORT_BODY, page.text) >= 0.75, page.text


def test_multiple_images_in_one_pdf_are_all_read(tmp_path, settings, tesseract_ready):
    images = [
        fixtures.render_a4_scan(fixtures.REPORT_HEADER, dpi=150),
        fixtures.render_a4_scan(fixtures.REPORT_BODY, dpi=150),
    ]
    path = tmp_path / "two-page-scan.pdf"
    fixtures.save_images_as_pdf(images, path, resolution=150)

    result = extract_document(str(path), "pdf", settings)

    assert len(result.pages) == 2
    assert all(page.source == "ocr" for page in result.pages)
    assert "CITY DIAGNOSTIC" in result.pages[0].text.upper()


def test_page_limit_truncates_and_warns(tmp_path, settings, tesseract_ready):
    images = [fixtures.render_a4_scan(fixtures.REPORT_HEADER, dpi=150) for _ in range(3)]
    path = tmp_path / "three-page-scan.pdf"
    fixtures.save_images_as_pdf(images, path, resolution=150)

    result = extract_document(str(path), "pdf", settings, max_pages=2)

    assert len(result.pages) == 2
    assert result.stats["page_count"] == 3
    assert result.stats["skipped_pages"] == 1
    assert any("only the first 2" in warning for warning in result.warnings)


def test_blank_image_reports_no_text(tmp_path, settings, tesseract_ready):
    path = tmp_path / "blank.png"
    fixtures.render_text_image([]).save(path)

    page = extract_document(str(path), "image", settings).pages[0]

    assert page.word_count == 0
    assert page.mean_confidence == 0.0
    assert any("No readable text" in warning for warning in page.warnings)
