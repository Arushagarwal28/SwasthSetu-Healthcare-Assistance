"""Whole-report summaries: counts, key points, mixed panels, disclaimers."""

from __future__ import annotations

import re

import pytest

from medical_report.explanation import explain_bilingual, explain_report
from medical_report.parsing import parse_document
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


def test_cbc_summary_reports_all_results_within_range():
    report = parsed("cbc")
    explained = explain_report(report, "en")
    summary = explained.summary

    assert summary.language == "en"
    assert summary.title == "Simplified summary of your laboratory report"
    assert summary.total_tests == len(report.tests) == 15
    assert sum(summary.counts.values()) == summary.total_tests
    assert summary.counts["WITHIN_RANGE"] == 15
    assert summary.counts["HIGH"] == 0
    assert "Every readable result is within the range printed on this report." in summary.key_points
    assert "15 readable test results" in summary.overview
    assert explained.provider == "rule-based"
    assert len(explained.tests) == 15
    assert [item.index for item in explained.tests] == [test.index for test in report.tests]


def test_summary_counts_outside_range_results():
    explained = explain_report(parsed("glucose"), "en")
    summary = explained.summary

    assert summary.counts["HIGH"] == 3
    assert summary.total_tests == 3
    outside = [point for point in summary.key_points if "outside the range" in point]
    assert len(outside) == 1
    assert "3 result(s)" in outside[0]
    assert "not by itself a diagnosis" in outside[0]
    assert "3 outside it" in summary.overview


def test_mixed_report_mentions_every_panel():
    report = parsed("mixed")
    explained = explain_report(report, "en")
    summary = explained.summary

    assert report.report.mixed is True
    assert "more than one panel" in summary.report_kind
    assert summary.categories == [
        "Complete Blood Count",
        "Lipid Profile",
        "Thyroid Profile",
    ]
    assert "Complete Blood Count" in summary.report_kind
    assert summary.total_tests == 26
    assert summary.counts["HIGH"] == 2


def test_mixed_report_hindi_panels_are_localised():
    explained = explain_report(parsed("mixed"), "hi")

    assert explained.summary.categories == [
        "संपूर्ण रक्त गणना",
        "लिपिड प्रोफ़ाइल",
        "थायरॉइड प्रोफ़ाइल",
    ]
    assert devanagari_ratio(explained.summary.report_kind) > 0.4


def test_messy_report_surfaces_unknown_and_review_counts():
    report = parsed("messy")
    explained = explain_report(report, "en")
    summary = explained.summary

    assert summary.counts["UNKNOWN"] >= 1
    assert summary.counts["NEEDS_REVIEW"] == 1
    review_points = [
        point for point in summary.key_points if "manual verification" in point.lower()
    ]
    assert len(review_points) == 1
    assert "1" in review_points[0]
    unknown_points = [point for point in summary.key_points if "could not be classified" in point]
    assert len(unknown_points) == 1


def test_messy_report_does_not_claim_every_result_is_within_range():
    """A partly unreadable report must never read like a clean result."""
    summary = explain_report(parsed("messy"), "en").summary

    assert summary.counts["WITHIN_RANGE"] >= 1
    assert summary.counts["UNKNOWN"] >= 1
    assert not any(
        "Every readable result" in point for point in summary.key_points
    ), "unknown results must suppress the all-within statement"

    hindi = explain_report(parsed("messy"), "hi").summary
    assert not any("हर पढ़ा गया परिणाम" in point for point in hindi.key_points)


def test_hindi_summary_matches_english_numbers():
    report = parsed("mixed")
    english = explain_report(report, "en")
    hindi = explain_report(report, "hi")

    assert hindi.summary.total_tests == english.summary.total_tests
    assert hindi.summary.counts == english.summary.counts
    assert hindi.summary.title == "आपकी प्रयोगशाला रिपोर्ट का सरल सारांश"
    assert devanagari_ratio(hindi.summary.overview) > 0.5
    assert hindi.summary.overview != english.summary.overview
    # Numbers must survive translation unchanged.
    assert str(hindi.summary.total_tests) in hindi.summary.overview


def test_disclaimers_and_next_steps_are_present_in_both_languages():
    report = parsed("cbc")
    english = explain_report(report, "en").summary
    hindi = explain_report(report, "hi").summary

    assert len(english.disclaimers) == 3
    assert len(hindi.disclaimers) == 3
    joined = " ".join(english.disclaimers).lower()
    assert "not a medical diagnosis" in joined
    assert "do not start, stop or change any medicine" in joined
    assert "seek medical care immediately" in joined

    hindi_joined = " ".join(hindi.disclaimers)
    assert devanagari_ratio(hindi_joined) > 0.6
    assert "कोई दवा शुरू, बंद या बदलें नहीं" in hindi_joined

    assert len(english.next_steps) == len(hindi.next_steps) == 4
    assert "doctor" in " ".join(english.next_steps).lower()


def test_empty_report_is_handled_without_inventing_content():
    report = parse_document(reports.build_document([[["Not a laboratory report"]]]))
    explained = explain_report(report, "en")

    assert explained.tests == []
    assert explained.summary.total_tests == 0
    assert "No test results could be read" in explained.summary.overview
    assert explained.summary.key_points == []
    assert explained.summary.disclaimers


def test_bilingual_output_shares_the_same_report_data():
    report = parsed("lft")
    both = explain_bilingual(report)

    assert set(both) == {"en", "hi"}
    assert both["en"].document_id == both["hi"].document_id == report.document_id
    assert len(both["en"].tests) == len(both["hi"].tests) == len(report.tests)
    for english, hindi in zip(both["en"].tests, both["hi"].tests):
        assert english.canonical_id == hindi.canonical_id
        assert english.status == hindi.status
        assert english.values_used == hindi.values_used
        assert english.known_test == hindi.known_test
        # The same printed value must appear in both languages.
        if english.values_used.get("value_raw"):
            assert english.values_used["value_raw"] in english.result_line
            assert english.values_used["value_raw"] in hindi.result_line


def test_render_produces_a_readable_bilingual_block():
    report = parsed("cbc")
    english_text = explain_report(report, "en").render()
    hindi_text = explain_report(report, "hi").render()

    assert "Simplified summary of your laboratory report" in english_text
    assert "आपकी प्रयोगशाला रिपोर्ट का सरल सारांश" in hindi_text
    assert english_text.count("\n- ") == 15
    assert devanagari_ratio(hindi_text) > 0.4


@pytest.mark.parametrize("name", ["cbc", "glucose", "lipid", "lft", "kft", "thyroid", "urine", "mixed"])
def test_every_corpus_report_supports_both_languages(name):
    report = parsed(name)
    both = explain_bilingual(report)

    for language in ("en", "hi"):
        explained = both[language]
        assert len(explained.tests) == len(report.tests)
        assert explained.summary.total_tests == len(report.tests)
        assert explained.summary.disclaimers
        for test in explained.tests:
            assert test.status_text.strip()
            assert test.result_line.strip()
