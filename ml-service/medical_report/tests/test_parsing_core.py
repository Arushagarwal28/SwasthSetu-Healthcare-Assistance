"""Unit tests for the parsing primitives."""

from __future__ import annotations

import pytest

from medical_report.parsing import classify, names, ranges, rows, units, values
from medical_report.parsing.catalog import get as get_definition
from medical_report.pipeline.types import Line, Word


def test_abbreviations_resolve_to_canonical_tests():
    cases = {
        "Hb": "hemoglobin",
        "Hgb": "hemoglobin",
        "TLC": "wbc_count",
        "PLT": "platelet_count",
        "PCV": "hematocrit",
        "FBS": "fasting_glucose",
        "PPBS": "postprandial_glucose",
        "SGPT": "alt",
        "SGOT": "ast",
        "ALP": "alp",
        "eGFR": "egfr",
        "FT3": "free_t3",
        "FT4": "free_t4",
        "TSH": "tsh",
    }
    for printed, expected in cases.items():
        match = names.match(printed)
        assert match.definition is not None, printed
        assert match.definition.id == expected, printed


def test_parenthetical_and_specimen_names():
    assert names.match("Hemoglobin (Hb)").definition.id == "hemoglobin"
    assert names.match("SGPT (ALT)").definition.id == "alt"
    assert names.match("Serum Creatinine").definition.id == "creatinine"


def test_hindi_test_name_is_recognised():
    assert names.match("हीमोग्लोबिन").definition.id == "hemoglobin"


def test_ambiguous_name_is_reported_and_context_resolves_it():
    without_context = names.match("Bilirubin")
    assert without_context.definition is None
    assert without_context.method == "ambiguous"
    assert "Bilirubin" in without_context.candidates

    in_urine = names.match("Bilirubin", "urine")
    assert in_urine.definition is not None
    assert in_urine.definition.id == "urine_bilirubin"


def test_rbc_is_resolved_by_section_context():
    assert names.match("RBC", "cbc").definition.id == "rbc_count"
    assert names.match("RBC", "urine").definition.id == "urine_rbc"


def test_fuzzy_match_handles_ocr_typo():
    match = names.match("Hcmoglobin")
    assert match.definition is not None
    assert match.definition.id == "hemoglobin"
    assert match.method == "fuzzy"
    assert match.score >= names.FUZZY_MIN_SCORE


def test_unknown_name_is_not_forced_onto_a_test():
    match = names.match("Vitamin D (25-OH)")
    assert match.definition is None
    assert match.method == "unknown"


def test_unit_normalisation_and_preservation():
    assert units.normalize_unit("gm/dl").normalized == "g/dL"
    assert units.normalize_unit("mg/dl").normalized == "mg/dL"
    assert units.normalize_unit("/cumm").normalized == "/µL"
    assert units.normalize_unit("uIU/mL").normalized == "µIU/mL"
    assert units.normalize_unit("meq/l").normalized == "mEq/L"

    unknown = units.normalize_unit("furlongs")
    assert unknown.known is False
    assert unknown.normalized == "furlongs"


def test_unit_prefix_matching_and_word_rejection():
    match = units.match_unit_prefix("g/dL 12.0 - 15.0")
    assert match is not None
    assert match.normalized == "g/dL"
    assert match.remainder == "12.0 - 15.0"

    assert units.match_unit_prefix("TSH 6.2") is None
    assert units.looks_like_unit("TSH") is False


def test_range_forms():
    interval = ranges.parse("12.0 - 15.0")
    assert (interval.kind, interval.low, interval.high) == ("interval", 12.0, 15.0)

    exclusive_upper = ranges.parse("< 150")
    assert exclusive_upper.kind == "upper"
    assert exclusive_upper.high == 150.0
    assert exclusive_upper.high_inclusive is False

    inclusive_upper = ranges.parse("Up to 200")
    assert inclusive_upper.kind == "upper"
    assert inclusive_upper.high_inclusive is True

    lower = ranges.parse("> 40")
    assert lower.kind == "lower"
    assert lower.low == 40.0
    assert lower.low_inclusive is False

    qualitative = ranges.parse("Negative")
    assert qualitative.kind == "qualitative"
    assert qualitative.qualitative_expected == "negative"

    unknown = ranges.parse("see note")
    assert unknown.kind == "unknown"
    assert unknown.present is False
    assert ranges.parse(None).kind == "unknown"


def test_value_parsing_is_conservative():
    assert values.parse_value("13,4").numeric == 13.4
    assert values.parse_value("13,4").warning == "decimal_comma"
    assert values.parse_value("7,200").numeric == 7200.0
    assert values.parse_value("05").numeric == 5.0

    comparator = values.parse_value("<0.5")
    assert comparator.numeric == 0.5
    assert comparator.comparator == "<"

    assert values.parse_value("Negative").qualitative == "negative"
    assert values.parse_value("Nil").qualitative == "negative"
    assert values.parse_value("2+").qualitative == "2+"

    assert values.parse_value("4-5").kind == "unparsed"
    assert values.parse_value("1O.5").kind == "unparsed"
    assert values.parse_value("").kind == "missing"


def test_classification_rules():
    hemoglobin = get_definition("hemoglobin")
    reference = ranges.parse("12.0 - 15.0")

    within = classify.classify(values.parse_value("13.4"), reference, None, hemoglobin)
    assert within.status == "WITHIN_RANGE"
    assert within.basis == "reference_range"

    high = classify.classify(values.parse_value("16.2"), reference, None, hemoglobin)
    assert high.status == "HIGH"

    low = classify.classify(values.parse_value("11.2"), reference, None, hemoglobin)
    assert low.status == "LOW"

    no_range = classify.classify(values.parse_value("13.4"), ranges.parse(None), None, hemoglobin)
    assert no_range.status == "UNKNOWN"
    assert no_range.basis == "no_reference_range"

    flag_only = classify.classify(values.parse_value("13.4"), ranges.parse(None), "high", hemoglobin)
    assert flag_only.status == "HIGH"
    assert flag_only.basis == "lab_flag"

    conflict = classify.classify(values.parse_value("13.4"), reference, "high", hemoglobin)
    assert conflict.status == "NEEDS_REVIEW"
    assert "lab_flag_conflicts_with_reference_range" in conflict.review_reasons

    incomparable = classify.classify(values.parse_value(">5"), ranges.parse("< 4"), None, hemoglobin)
    assert incomparable.status == "NEEDS_REVIEW"

    missing = classify.classify(values.parse_value(""), reference, None, hemoglobin)
    assert missing.status == "UNKNOWN"
    assert "value_missing" in missing.review_reasons

    unreadable = classify.classify(values.parse_value("1O.5"), reference, None, hemoglobin)
    assert unreadable.status == "NEEDS_REVIEW"

    protein = get_definition("urine_protein")
    abnormal = classify.classify(values.parse_value("Trace"), ranges.parse("Negative"), "abnormal", protein)
    assert abnormal.status == "ABNORMAL"

    negative = classify.classify(values.parse_value("Negative"), ranges.parse("Negative"), None, protein)
    assert negative.status == "WITHIN_RANGE"


def _line(rows_of_cells):
    top = 100.0
    cells = []
    parts = []
    for index, text in enumerate(rows_of_cells):
        x0 = 20.0 + index * 120.0
        cells.append([Word(text=text, x0=x0, x1=x0 + len(text) * 6.0, top=top, bottom=top + 11.0)])
        parts.append(text)
    return Line(text="  ".join(parts), cells=cells, x0=20.0, x1=580.0, top=top, bottom=top + 11.0)


def test_row_extraction_columns():
    parsed = rows.parse_line(_line(["Hemoglobin", "13.4", "g/dL", "12.0 - 15.0", "H"]), 0, 0)

    assert len(parsed) == 1
    assert parsed[0].name_text == "Hemoglobin"
    assert parsed[0].value_text == "13.4"
    assert parsed[0].unit_text == "g/dL"
    assert parsed[0].range_text == "12.0 - 15.0"
    assert parsed[0].flag_text == "H"


def test_row_extraction_two_records_on_one_line():
    parsed = rows.parse_line(
        _line(["WBC", "7200", "/uL", "4000 - 11000", "RBC", "4.8", "million/uL", "4.0 - 5.2"]), 0, 0
    )

    assert [row.name_text for row in parsed] == ["WBC", "RBC"]
    assert parsed[0].value_text == "7200"
    assert parsed[1].range_text == "4.0 - 5.2"
    assert parsed[0].key[2] == 0 and parsed[1].key[2] == 1


def test_row_extraction_inline_text():
    split = rows.split_inline("Total Cholesterol: 196 mg/dL")
    assert split is not None
    assert split.name == "Total Cholesterol"
    assert split.value == "196"

    parsed = rows.parse_line(_line(["Hemoglobin 13.4 g/dL 12.0 - 15.0"]), 0, 0)
    assert len(parsed) == 1
    assert parsed[0].name_text == "Hemoglobin"
    assert parsed[0].unit_text == "g/dL"
    assert parsed[0].range_text == "12.0 - 15.0"


def test_decompose_tail_refuses_unexplained_text():
    assert rows.decompose_tail("g/dL 12.0 - 15.0") == ("g/dL", "12.0 - 15.0", None)
    assert rows.decompose_tail("Hemoglobin") is None
    assert rows.decompose_tail("TSH") is None


def test_hemoglobin_variant_spellings_all_match():
    for spelling in ("Haemoglobin", "HB", "Hgb", "hb conc"):
        assert names.match(spelling).definition.id == "hemoglobin", spelling


@pytest.mark.parametrize("text,expected", [("Total Leucocyte Count", "wbc_count"), ("TLC", "wbc_count")])
def test_leucocyte_abbreviations(text, expected):
    assert names.match(text).definition.id == expected
