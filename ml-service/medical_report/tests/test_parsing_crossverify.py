"""English cross-verification of numeric fields."""

from __future__ import annotations

import pytest

from medical_report.parsing import parse_document, parse_document_file, values
from medical_report.parsing.types import Verification
from medical_report.testing import fixtures, reports


class StubVerifier:
    def __init__(self, agreement: str, secondary: str | None = None):
        self.agreement = agreement
        self.secondary = secondary
        self.calls = 0

    def __call__(self, page, bbox, primary_text) -> Verification:
        self.calls += 1
        return Verification(
            checked=True,
            primary_reading=primary_text,
            secondary_reading=self.secondary,
            agreement=self.agreement,
            languages=("eng",),
        )


def test_disagreement_marks_needs_review_without_changing_the_value():
    document = reports.build_document([reports.CBC], page_source="ocr")
    parsed = parse_document(document, verifier=StubVerifier("mismatch", "3.4"))

    hemoglobin = parsed.by_canonical_id("hemoglobin")
    assert hemoglobin.status == "NEEDS_REVIEW"
    assert hemoglobin.needs_review is True
    assert "english_ocr_disagrees" in hemoglobin.review_reasons
    assert hemoglobin.value_numeric == pytest.approx(13.4)
    assert hemoglobin.extracted_value_numeric == pytest.approx(13.4)
    assert hemoglobin.verification.primary_reading == "13.4"
    assert hemoglobin.verification.secondary_reading == "3.4"
    assert hemoglobin.confidence <= 45


def test_agreement_keeps_the_deterministic_status():
    document = reports.build_document([reports.CBC], page_source="ocr")
    parsed = parse_document(document, verifier=StubVerifier("match", "13.4"))

    hemoglobin = parsed.by_canonical_id("hemoglobin")
    assert hemoglobin.status == "WITHIN_RANGE"
    assert hemoglobin.needs_review is False
    assert hemoglobin.verification.agreement == "match"
    assert hemoglobin.confidence >= 80


def test_unavailable_verification_does_not_force_review():
    document = reports.build_document([reports.CBC], page_source="ocr")
    parsed = parse_document(document, verifier=StubVerifier("unavailable"))

    hemoglobin = parsed.by_canonical_id("hemoglobin")
    assert hemoglobin.status == "WITHIN_RANGE"
    assert hemoglobin.needs_review is False


def test_digital_pages_are_not_cross_verified():
    verifier = StubVerifier("mismatch", "3.4")
    parsed = parse_document(reports.build_document([reports.CBC]), verifier=verifier)

    assert verifier.calls == 0
    assert parsed.by_canonical_id("hemoglobin").verification.checked is False


@pytest.mark.ocr
def test_english_cross_check_on_hindi_scan(tmp_path, settings, tesseract_ready):
    path = tmp_path / "hindi-report.png"
    fixtures.render_text_image(
        ["हीमोग्लोबिन 13.4 g/dL 12.0 - 15.0"],
        devanagari=True,
        font_size=40,
        line_spacing=2.0,
    ).save(path)

    parsed = parse_document_file(str(path), "image", settings, languages=["hin", "eng"])
    hemoglobin = parsed.by_canonical_id("hemoglobin")

    assert hemoglobin is not None, [test.name_raw for test in parsed.tests]
    assert hemoglobin.verification.checked is True
    secondary = hemoglobin.verification.secondary_reading
    assert secondary is not None
    assert values.to_float(secondary.replace(",", ".")) == pytest.approx(13.4, abs=0.01)

    print(
        f"\nhindi cross-check: primary={hemoglobin.value_raw!r} "
        f"secondary={secondary!r} agreement={hemoglobin.verification.agreement} "
        f"status={hemoglobin.status}"
    )

    if hemoglobin.verification.agreement == "mismatch":
        assert hemoglobin.status == "NEEDS_REVIEW"
        assert "english_ocr_disagrees" in hemoglobin.review_reasons
    else:
        assert hemoglobin.value_numeric == pytest.approx(13.4, abs=0.01)
