"""Language handling: overrides, validation and Hindi (Devanagari) OCR."""

from __future__ import annotations

import pytest
from PIL import features

from medical_report.errors import InvalidLanguage
from medical_report.pipeline.evaluation import devanagari_ratio
from medical_report.pipeline.extract import extract_document
from medical_report.testing import fixtures

pytestmark = pytest.mark.ocr


def test_language_override_is_honoured(tmp_path, settings, tesseract_ready):
    path = tmp_path / "scan.png"
    fixtures.render_text_image(fixtures.REPORT_BODY).save(path)

    page = extract_document(str(path), "image", settings, languages=["eng"]).pages[0]

    assert page.languages == ["eng"]
    assert page.preprocessing["language_selection"]["source"] == "request"


def test_unknown_language_is_rejected(tmp_path, settings, tesseract_ready):
    path = tmp_path / "scan.png"
    fixtures.render_text_image(fixtures.REPORT_BODY).save(path)

    with pytest.raises(InvalidLanguage) as error:
        extract_document(str(path), "image", settings, languages=["klingon"])

    assert "klingon" in str(error.value.details.get("missing"))


def test_hindi_scan_yields_devanagari_text(tmp_path, settings, tesseract_ready):
    if not features.check("raqm"):
        pytest.skip("Pillow was built without Raqm, so Devanagari cannot be shaped for the fixture")
    if not fixtures.devanagari_available():
        pytest.skip("No Devanagari font is installed")

    path = tmp_path / "hindi.png"
    fixtures.render_text_image(
        fixtures.HINDI_LINES, devanagari=True, font_size=40, line_spacing=2.0
    ).save(path)

    page = extract_document(str(path), "image", settings, languages=["hin", "eng"]).pages[0]

    ratio = devanagari_ratio(page.text)
    print(f"\nhindi OCR: ratio={ratio:.2f} conf={page.mean_confidence} text={page.text!r}")
    assert page.languages == ["hin", "eng"]
    assert ratio >= 0.3, page.text
    # The hin model reliably recovers Devanagari but misreads some digits
    # ("13.4" -> "3.4"), so only require that numeric content survives.
    assert sum(1 for char in page.text if char.isdigit()) >= 2, page.text
