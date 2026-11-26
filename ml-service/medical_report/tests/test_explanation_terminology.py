"""The curated terminology dictionary: coverage, bilingual content, safety."""

from __future__ import annotations

import re

import pytest

from medical_report.explanation import ENTRIES, REFERENCES, coverage
from medical_report.explanation.references import BY_ID
from medical_report.explanation.terms_cbc import CBC_TERMS
from medical_report.explanation.terms_panels import PANEL_TERMS
from medical_report.explanation.terms_urine import URINE_TERMS
from medical_report.parsing import catalog

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")

#: Phrases that would turn a description into advice or a diagnosis.
BANNED_PATTERNS = (
    r"\byou (may|might|could) have\b",
    r"\byou have (a|an)\b",
    r"\b(should|must|need to) take\b",
    r"\bdiagnos",
    r"\bprescrib",
    r"\btreat(ment|ing)?\b",
    r"\bdose\b",
    r"\bmg\b",
    r"\bshould (start|stop|take)\b",
)

#: A range-like pattern, which must never appear in the dictionary.
RANGE_PATTERN = re.compile(r"\d\s*[-–]\s*\d")


def devanagari_ratio(text: str) -> float:
    devanagari = len(DEVANAGARI.findall(text))
    latin = len(LATIN.findall(text))
    total = devanagari + latin
    return devanagari / total if total else 0.0


def test_every_catalog_test_has_an_entry():
    report = coverage()

    assert report["catalog_total"] == 76
    assert report["dictionary_total"] == 76
    assert report["missing"] == []
    assert report["extra"] == []
    assert report["ratio"] == 1.0


def test_catalog_ids_match_catalogue_exactly():
    catalog_ids = {test.id for test in catalog.TESTS}
    assert set(ENTRIES) == catalog_ids


def test_no_duplicate_entries():
    all_terms = CBC_TERMS + PANEL_TERMS + URINE_TERMS
    assert len(all_terms) == len(ENTRIES) == len({term.test_id for term in all_terms})


@pytest.mark.parametrize("test_id", sorted(ENTRIES))
def test_entry_is_bilingual_and_non_empty(test_id):
    entry = ENTRIES[test_id]

    assert entry.name_en.strip()
    assert entry.name_hi.strip()
    assert entry.measures_en.strip()
    assert entry.measures_hi.strip()
    if entry.name_hi == entry.name_en:
        # A few names are Latin abbreviations in Hindi reports too (ALT, SGPT).
        # An untranslated English sentence would contain a long lowercase word.
        assert not re.search(r"[a-z]{4,}", entry.name_hi), entry.name_hi
    else:
        assert devanagari_ratio(entry.name_hi) > 0.0, entry.name_hi
    assert devanagari_ratio(entry.measures_hi) > 0.5, entry.measures_hi
    # The Hindi text must not simply repeat the English sentence.
    assert entry.measures_hi != entry.measures_en


@pytest.mark.parametrize("test_id", sorted(ENTRIES))
def test_entry_cites_a_known_source(test_id):
    entry = ENTRIES[test_id]

    assert entry.references
    for reference_id in entry.references:
        assert reference_id in BY_ID, reference_id


@pytest.mark.parametrize("test_id", sorted(ENTRIES))
def test_entry_contains_no_diagnosis_advice_or_range(test_id):
    entry = ENTRIES[test_id]
    texts = [entry.measures_en, entry.note_en, entry.measures_hi, entry.note_hi]

    for text in texts:
        assert not RANGE_PATTERN.search(text), (test_id, text)
        lowered = text.lower()
        for pattern in BANNED_PATTERNS:
            assert not re.search(pattern, lowered), (test_id, pattern, text)


def test_references_are_documented_with_urls():
    assert len(REFERENCES) >= 4
    urls = [reference.url for reference in REFERENCES]
    assert all(url.startswith("https://") for url in urls)
    assert len(set(urls)) == len(urls)
    for reference in REFERENCES:
        assert reference.used_for.strip()
        assert reference.publisher.strip()

    ids = {reference.id for reference in REFERENCES}
    assert "medlineplus-lab-tests" in ids
    assert "icmr-gclp" in ids


def test_entries_for_ratios_and_derived_indices_exist():
    for test_id in ("chol_hdl_ratio", "ag_ratio", "urea_creatinine_ratio", "egfr"):
        assert test_id in ENTRIES
