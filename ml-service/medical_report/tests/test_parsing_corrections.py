"""Manual corrections preserve the extracted original."""

from __future__ import annotations

import pytest

from medical_report.parsing import FieldCorrection, apply_corrections, parse_document
from medical_report.testing import reports


def _single_report():
    return parse_document(reports.build_document([[ ["Hemoglobin", "11.2", "g/dL", "12.0 - 15.0"] ]]))


def _correction(**overrides) -> FieldCorrection:
    payload = dict(
        index=0,
        field="value",
        corrected="13.9",
        corrected_by="dr-test",
        corrected_at="2026-01-01T00:00:00Z",
        note="checked against the printed report",
    )
    payload.update(overrides)
    return FieldCorrection(**payload)


def test_value_correction_preserves_the_original():
    parsed = _single_report()
    assert parsed.tests[0].status == "LOW"

    corrected = apply_corrections(parsed, [_correction()])
    hemoglobin = corrected.tests[0]

    assert hemoglobin.value_numeric == pytest.approx(13.9)
    assert hemoglobin.status == "WITHIN_RANGE"
    assert hemoglobin.needs_review is False

    assert hemoglobin.extracted_value_numeric == pytest.approx(11.2)
    assert hemoglobin.extracted_value_raw == "11.2"
    assert hemoglobin.corrections[0].original == "11.2"
    assert hemoglobin.corrections[0].corrected == "13.9"
    assert hemoglobin.corrections[0].corrected_by == "dr-test"

    assert len(corrected.corrections) == 1
    assert corrected.corrections[0].field == "value"
    # the original report object is untouched
    assert parsed.tests[0].value_numeric == pytest.approx(11.2)


def test_reference_range_correction_recomputes_status():
    parsed = parse_document(reports.build_document([[ ["Hemoglobin", "13.4", "g/dL", "12.0 - 15.0"] ]]))

    corrected = apply_corrections(
        parsed,
        [_correction(field="reference_range", corrected="13.0 - 14.0", note="lab issued a corrected range")],
    )
    hemoglobin = corrected.tests[0]

    assert hemoglobin.reference.low == 13.0
    assert hemoglobin.reference.high == 14.0
    assert hemoglobin.status == "WITHIN_RANGE"
    assert hemoglobin.extracted_reference_text == "12.0 - 15.0"


def test_unit_correction_changes_only_the_unit():
    parsed = parse_document(reports.build_document([[ ["Hemoglobin", "13.4", "gm%", "12.0 - 15.0"] ]]))

    corrected = apply_corrections(parsed, [_correction(field="unit", corrected="g/L", note="unit restated")])
    hemoglobin = corrected.tests[0]

    assert hemoglobin.unit_normalized == "g/L"
    assert hemoglobin.unit_raw == "g/L"
    assert hemoglobin.value_numeric == pytest.approx(13.4)
    assert hemoglobin.extracted_unit_raw == "gm%"


def test_name_correction_remaps_the_test():
    parsed = parse_document(reports.build_document([[ ["Hgb Conc", "13.4", "g/dL", "12.0 - 15.0"] ]]))
    corrected = apply_corrections(parsed, [_correction(field="name", corrected="Haemoglobin")])
    hemoglobin = corrected.tests[0]

    assert hemoglobin.canonical_id == "hemoglobin"
    assert hemoglobin.category == "cbc"
    assert hemoglobin.name_match_method == "alias"
    assert hemoglobin.extracted_value_raw == "13.4"


def test_correction_for_missing_target_is_reported_not_applied():
    parsed = _single_report()
    corrected = apply_corrections(parsed, [_correction(index=99)])

    assert len(corrected.corrections) == 0
    assert corrected.tests[0].value_numeric == pytest.approx(11.2)
    assert any("index 99" in warning for warning in corrected.warnings)


def test_unsupported_field_is_rejected():
    parsed = _single_report()
    corrected = apply_corrections(parsed, [_correction(field="diagnosis", corrected="anaemia")])

    assert len(corrected.corrections) == 0
    assert any("unsupported field" in warning for warning in corrected.warnings)


def test_supported_fields_are_documented():
    from medical_report.parsing.corrections import SUPPORTED_FIELDS

    assert set(SUPPORTED_FIELDS) == {"value", "unit", "reference_range", "name"}


def test_corrections_are_serialisable():
    parsed = apply_corrections(_single_report(), [_correction()])
    payload = parsed.to_dict()

    record = payload["tests"][0]["corrections"][0]
    assert record["original"] == "11.2"
    assert record["corrected"] == "13.9"
    assert payload["corrections"][0]["field"] == "value"
    assert parsed.tests[0].to_dict()["extracted"]["value_numeric"] == pytest.approx(11.2)
