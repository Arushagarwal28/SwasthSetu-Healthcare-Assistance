"""Per-result explanations: statuses, missing data, uncertainty and corrections."""

from __future__ import annotations

import re
from dataclasses import replace

import pytest

from medical_report.explanation import explain_report, explain_test
from medical_report.parsing import parse_document
from medical_report.parsing.corrections import FieldCorrection, apply_corrections
from medical_report.parsing.types import (
    STATUS_ABNORMAL,
    STATUS_HIGH,
    STATUS_LOW,
    STATUS_NEEDS_REVIEW,
    STATUS_UNKNOWN,
    STATUS_WITHIN_RANGE,
    Verification,
)
from medical_report.testing import reports

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")


def devanagari_ratio(text: str) -> float:
    devanagari = len(DEVANAGARI.findall(text))
    latin = len(LATIN.findall(text))
    total = devanagari + latin
    return devanagari / total if total else 0.0


def parsed(name: str):
    return parse_document(reports.build_document(reports.REPORTS[name]))


@pytest.fixture(scope="module")
def cbc():
    return parsed("cbc")


@pytest.fixture(scope="module")
def messy():
    return parsed("messy")


def with_ocr_disagreement(report, canonical_id: str):
    """Re-shape one result to look like a failed English cross-check."""

    tests = []
    for test in report.tests:
        if test.canonical_id == canonical_id:
            test = replace(
                test,
                status=STATUS_NEEDS_REVIEW,
                value_raw="73.4",
                value_numeric=73.4,
                needs_review=True,
                review_reasons=["english_ocr_disagrees"],
                verification=Verification(
                    checked=True,
                    primary_reading="73.4",
                    secondary_reading="13.4",
                    agreement="mismatch",
                    languages=("eng",),
                ),
            )
        tests.append(test)
    return replace(report, tests=tests)


# --------------------------------------------------------------- statuses
def test_within_range_explanation_quotes_the_printed_range(cbc):
    test = cbc.by_canonical_id("hemoglobin")
    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_WITHIN_RANGE
    assert "12.0 - 15.0" in explanation.result_line
    assert "13.4" in explanation.result_line
    assert "within the reference range" in explanation.status_text.lower()
    assert explanation.status_label == "Within the report's range"
    assert "oxygen" in explanation.measures
    assert "medlineplus-lab-tests" in explanation.references
    assert explanation.caution is None
    assert explanation.values_used["value_raw"] == "13.4"
    assert explanation.values_used["status"] == STATUS_WITHIN_RANGE


def test_high_result_states_direction_and_range():
    report = parsed("glucose")
    test = report.by_canonical_id("fasting_glucose")
    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_HIGH
    assert "above the reference range" in explanation.status_text
    assert "70 - 100" in explanation.status_text
    assert "142" in explanation.result_line
    assert "Above" in explanation.status_label
    # The explanation must not name a disease or a medicine.
    lowered = (explanation.status_text + " " + (explanation.measures or "")).lower()
    assert "diabet" not in lowered
    assert "insulin" not in lowered


def test_low_result_states_direction_and_comparator_range():
    report = parsed("kft")
    test = report.by_canonical_id("egfr")
    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_LOW
    assert "below the reference range" in explanation.status_text
    assert "> 90" in explanation.status_text


def test_abnormal_qualitative_result_uses_printed_expectation():
    report = parsed("urine")
    test = report.by_canonical_id("urine_protein")
    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_ABNORMAL
    assert "Negative" in explanation.status_text
    assert "abnormal" in explanation.status_text.lower()
    assert "Trace" in explanation.result_line


# ------------------------------------------------------------ missing data
def test_missing_value_is_not_invented(messy):
    test = messy.by_canonical_id("creatinine")
    assert test.value_raw is None

    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_UNKNOWN
    assert explanation.values_used["value_raw"] is None
    assert explanation.values_used["value_numeric"] is None
    assert "no value readable" in explanation.result_line.lower()
    assert "no result value could be read" in explanation.status_text.lower()
    assert explanation.caution is not None
    assert "does not show a value" in explanation.caution


def test_missing_value_hindi(messy):
    test = messy.by_canonical_id("creatinine")
    explanation = explain_test(test, "hi")

    assert devanagari_ratio(explanation.status_text) > 0.5
    assert "कोई परिणाम मान" in explanation.status_text
    assert explanation.status == STATUS_UNKNOWN


def test_numeric_value_without_printed_range_is_not_judged(cbc):
    test = replace(
        cbc.by_canonical_id("hemoglobin"),
        reference=replace(cbc.by_canonical_id("hemoglobin").reference, kind="unknown", text_raw=None),
        status=STATUS_UNKNOWN,
    )
    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_UNKNOWN
    assert "does not print a reference range" in explanation.status_text
    assert "13.4" in explanation.status_text
    # No invented range and no direction claim.
    assert "12.0 - 15.0" not in explanation.status_text
    assert "above" not in explanation.status_text.lower()
    assert "below" not in explanation.status_text.lower()


def test_unknown_test_keeps_printed_name_and_says_so(messy):
    test = next(item for item in messy.tests if item.canonical_id is None)
    explanation = explain_test(test, "en")

    assert explanation.known_test is False
    assert explanation.measures is None
    assert explanation.name == test.name_raw
    assert "18 ng/mL" in explanation.result_line
    assert "not in our dictionary" in (explanation.interpretation_note or "")
    assert explanation.caution is not None
    assert "not in our dictionary" in explanation.caution


# ------------------------------------------------------------- uncertainty
def test_needs_review_explains_uncertainty_without_a_direction(messy):
    report = with_ocr_disagreement(messy, "hba1c")
    test = report.by_canonical_id("hba1c")

    explanation = explain_test(test, "en")

    assert explanation.status == STATUS_NEEDS_REVIEW
    assert "could not be confirmed" in explanation.status_text
    assert "not being interpreted as a finding" in explanation.status_text
    assert explanation.caution is not None
    assert "73.4" in explanation.caution and "13.4" in explanation.caution
    assert "read twice" in explanation.caution
    lowered = explanation.status_text.lower()
    assert "above" not in lowered
    assert "below" not in lowered
    assert explanation.status_label == "Needs manual verification"


def test_needs_review_hindi_has_no_direction_claim(messy):
    report = with_ocr_disagreement(messy, "hba1c")
    explanation = explain_test(report.by_canonical_id("hba1c"), "hi")

    assert "पुष्ट नहीं हो सका" in explanation.status_text
    assert "से अधिक" not in explanation.status_text
    assert "से कम" not in explanation.status_text
    assert "73.4" in explanation.caution and "13.4" in explanation.caution


def test_unrecognised_unit_is_explained(messy):
    test = replace(
        messy.by_canonical_id("creatinine"),
        unit_raw="gms%",
        unit_known=False,
        status=STATUS_NEEDS_REVIEW,
        review_reasons=["unrecognized_unit"],
        needs_review=True,
    )
    explanation = explain_test(test, "en")

    assert "gms%" in explanation.caution
    assert "not one this tool recognises" in explanation.caution


def test_every_review_reason_has_bilingual_wording(messy):
    reasons = [
        "value_missing",
        "value_unreadable",
        "value_not_cleanly_numeric",
        "value_looks_like_a_range",
        "comparator_prevents_comparison",
        "lab_flag_conflicts_with_reference_range",
        "qualitative_value_not_interpretable",
        "english_ocr_disagrees",
        "ambiguous_test_name",
        "unknown_test_name",
        "unrecognized_unit",
        "classification_requires_review",
    ]
    base = messy.by_canonical_id("creatinine")

    for reason in reasons:
        test = replace(
            base,
            status=STATUS_NEEDS_REVIEW,
            review_reasons=[reason],
            needs_review=True,
        )
        english = explain_test(test, "en")
        hindi = explain_test(test, "hi")
        assert english.caution and reason not in english.caution, reason
        assert hindi.caution and devanagari_ratio(hindi.caution) > 0.4, reason


# -------------------------------------------------------------- corrections
def test_corrected_value_is_explained_and_original_is_kept(messy):
    original = messy.by_canonical_id("hba1c")
    assert original.extracted_value_raw == "1O.5"

    corrected = apply_corrections(
        messy,
        [
            FieldCorrection(
                index=original.index,
                field="value",
                corrected="5.5",
                corrected_by="technician@example.org",
                corrected_at="2026-11-25T10:00:00Z",
                note="checked against the printed report",
            )
        ],
    )
    test = corrected.by_canonical_id("hba1c")

    assert test.value_raw == "5.5"
    assert test.extracted_value_raw == "1O.5"
    assert test.status == STATUS_WITHIN_RANGE

    explanation = explain_test(test, "en")
    assert "5.5" in explanation.result_line
    assert explanation.values_used["value_raw"] == "5.5"
    assert explanation.correction_note is not None
    assert "1O.5" in explanation.correction_note
    assert "corrected" in explanation.correction_note.lower()
    assert "still kept" in explanation.correction_note


def test_corrected_value_hindi_note(messy):
    original = messy.by_canonical_id("hba1c")
    corrected = apply_corrections(
        messy,
        [
            FieldCorrection(
                index=original.index,
                field="value",
                corrected="5.5",
                corrected_by="technician@example.org",
                corrected_at="2026-11-25T10:00:00Z",
            )
        ],
    )
    explanation = explain_test(corrected.by_canonical_id("hba1c"), "hi")

    assert explanation.correction_note is not None
    assert devanagari_ratio(explanation.correction_note) > 0.4
    assert "मान" in explanation.correction_note


# ------------------------------------------------------------------ safety
def test_explanations_never_modify_the_parsed_report():
    report = parsed("mixed")
    before = report.to_dict()

    for test in report.tests:
        explain_test(test, "en")
        explain_test(test, "hi")
    explain_report(report, "en")
    explain_report(report, "hi")

    assert report.to_dict() == before


def test_unsupported_language_is_rejected(cbc):
    with pytest.raises(ValueError):
        explain_test(cbc.tests[0], "fr")
    with pytest.raises(ValueError):
        explain_report(cbc, "de")


def test_all_six_statuses_are_explained():
    statuses = set()
    for name in ("cbc", "glucose", "kft", "urine", "messy"):
        for test in parsed(name).tests:
            explanation = explain_test(test, "en")
            statuses.add(explanation.status)
            assert explanation.status_text.strip()
            assert explanation.status_label.strip()

    assert statuses == {
        STATUS_WITHIN_RANGE,
        STATUS_HIGH,
        STATUS_LOW,
        STATUS_ABNORMAL,
        STATUS_UNKNOWN,
        STATUS_NEEDS_REVIEW,
    }
