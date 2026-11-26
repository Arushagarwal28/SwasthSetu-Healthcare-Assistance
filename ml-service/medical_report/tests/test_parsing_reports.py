"""End-to-end parsing of the synthetic report corpus."""

from __future__ import annotations

import pytest

from medical_report.parsing import parse_document, parse_document_file
from medical_report.testing import reports


@pytest.mark.parametrize("name", ["cbc", "glucose", "lipid", "lft", "kft", "thyroid", "urine"])
def test_category_report_parses_as_expected(name):
    parsed = parse_document(reports.build_document(reports.REPORTS[name]))
    expected = reports.EXPECTED[name]

    assert len(parsed.tests) == len(expected), [test.name_raw for test in parsed.tests]

    for test, want in zip(parsed.tests, expected):
        assert test.canonical_id == want["id"], (test.name_raw, test.canonical_id)
        if want.get("value") is not None:
            assert test.value_numeric == pytest.approx(want["value"]), test.name_raw
        if want.get("qualitative") is not None:
            assert test.value_qualitative == want["qualitative"], test.name_raw
        assert test.unit_normalized == want["unit"], (test.name_raw, test.unit_normalized)
        assert test.status == want["status"], (test.name_raw, test.status, test.status_reason)

    assert parsed.report.primary == reports.REPORT_CATEGORY[name]
    assert parsed.report.mixed is False


def test_cbc_confidence_and_source_are_tracked():
    parsed = parse_document(reports.build_document(reports.REPORTS["cbc"]))
    hemoglobin = parsed.by_canonical_id("hemoglobin")

    assert hemoglobin is not None
    assert hemoglobin.confidence >= 80
    assert hemoglobin.source.page_index == 0
    assert hemoglobin.source.page_source == "pdf_text"
    assert hemoglobin.source.bbox
    assert hemoglobin.verification.checked is False


def test_mixed_multi_page_report():
    parsed = parse_document(reports.build_document(reports.REPORTS["mixed"]))

    assert parsed.report.primary == "cbc"
    assert set(parsed.report.detected) == {"cbc", "lipid", "thyroid"}
    assert parsed.report.mixed is True
    assert parsed.stats["needs_review"] == 0

    pages = {test.source.page_index for test in parsed.tests}
    assert pages == {0, 1}
    assert parsed.tests[-1].source.page_index == 1


def test_messy_report_with_abbreviations_and_ocr_errors():
    parsed = parse_document(reports.build_document(reports.REPORTS["messy"]))
    expected = reports.EXPECTED["messy"]

    assert len(parsed.tests) == len(expected), [test.name_raw for test in parsed.tests]

    for test, want in zip(parsed.tests, expected):
        assert test.canonical_id == want["id"], (test.name_raw, test.canonical_id)
        if want.get("value") is not None:
            assert test.value_numeric == pytest.approx(want["value"]), test.name_raw
        assert test.unit_normalized == want["unit"], (test.name_raw, test.unit_normalized)
        assert test.status == want["status"], (test.name_raw, test.status, test.status_reason)


def test_unknown_test_is_kept_but_flagged():
    parsed = parse_document(reports.build_document([[ ["Vitamin D (25-OH)", "18", "ng/mL", "30 - 100"] ]]))
    vitamin_d = parsed.tests[0]

    assert vitamin_d.canonical_id is None
    assert vitamin_d.canonical_name.startswith("Vitamin D")
    assert vitamin_d.value_numeric == 18.0
    assert vitamin_d.status == "LOW"
    assert vitamin_d.needs_review is True
    assert "unknown_test_name" in vitamin_d.review_reasons


def test_missing_value_is_not_invented():
    parsed = parse_document(reports.build_document([[ ["Creatinine", "mg/dL"] ]]))
    creatinine = parsed.tests[0]

    assert creatinine.canonical_id == "creatinine"
    assert creatinine.value_raw is None
    assert creatinine.value_numeric is None
    assert creatinine.unit_normalized == "mg/dL"
    assert creatinine.status == "UNKNOWN"
    assert creatinine.status_basis == "no_value"
    assert "value_missing" in creatinine.review_reasons


def test_unreadable_value_is_flagged_not_repaired():
    parsed = parse_document(reports.build_document([[ ["HbA1c", "1O.5", "%", "4.0 - 5.6"] ]]))
    hba1c = parsed.tests[0]

    assert hba1c.value_raw == "1O.5"
    assert hba1c.value_numeric is None
    assert hba1c.status == "NEEDS_REVIEW"
    assert hba1c.needs_review is True


def test_no_test_results_produces_a_warning():
    parsed = parse_document(reports.build_document([[["This is not a laboratory report"]], [["Page 2"]]]))

    assert parsed.tests == []
    assert any("No test results could be parsed" in warning for warning in parsed.warnings)


def test_status_totals_match_test_count():
    parsed = parse_document(reports.build_document(reports.REPORTS["urine"]))

    total = sum(parsed.stats["by_status"].values())
    assert total == len(parsed.tests)
    assert parsed.stats["needs_review"] == sum(1 for test in parsed.tests if test.needs_review)
    assert parsed.stats["by_category"]["urine"] == len(parsed.tests)


def test_digital_pdf_end_to_end(tmp_path, settings):
    path = tmp_path / "cbc-report.pdf"
    reports.build_report_pdf(path, reports.REPORTS["cbc"])

    parsed = parse_document_file(str(path), "pdf", settings)

    assert parsed.stats["tests"] == len(reports.EXPECTED["cbc"])
    assert parsed.report.primary == "cbc"
    assert parsed.report.mixed is False
    hemoglobin = parsed.by_canonical_id("hemoglobin")
    assert hemoglobin.value_numeric == pytest.approx(13.4)
    assert hemoglobin.unit_normalized == "g/dL"
    assert hemoglobin.source.page_source == "pdf_text"


def test_pdf_with_two_sections_and_pages(tmp_path, settings):
    path = tmp_path / "mixed-report.pdf"
    reports.build_report_pdf(path, reports.REPORTS["mixed"])

    parsed = parse_document_file(str(path), "pdf", settings)

    assert parsed.report.mixed is True
    assert set(parsed.report.detected) == {"cbc", "lipid", "thyroid"}
    assert parsed.stats["page_count"] == 2
    assert any(test.source.page_index == 1 for test in parsed.tests)
