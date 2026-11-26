"""The curated bilingual medical terminology dictionary.

One entry per canonical test in the Phase 2 catalog (76 tests). Entries describe
what the test measures in plain English and plain Hindi. They deliberately
contain **no** reference ranges, thresholds or diagnoses: the only range this
system may use is the one printed on the patient's own report.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from ..parsing import catalog
from .terms_cbc import CBC_TERMS
from .terms_panels import PANEL_TERMS
from .terms_urine import URINE_TERMS
from .types import LANGUAGE_ENGLISH, LANGUAGE_HINDI, TerminologyEntry

ALL_TERMS: Tuple[TerminologyEntry, ...] = CBC_TERMS + PANEL_TERMS + URINE_TERMS

ENTRIES: Dict[str, TerminologyEntry] = {entry.test_id: entry for entry in ALL_TERMS}


def get(test_id: Optional[str]) -> Optional[TerminologyEntry]:
    """The dictionary entry for a canonical test id, or ``None`` if unknown."""

    if not test_id:
        return None
    return ENTRIES.get(test_id)


def name_for(test_id: Optional[str], language: str, fallback: str) -> str:
    """Localised display name, falling back to the name printed on the report."""

    entry = get(test_id)
    if entry is None:
        return fallback
    if language == LANGUAGE_HINDI:
        return entry.name_hi or entry.name_en or fallback
    return entry.name_en or fallback


def measures_for(test_id: Optional[str], language: str) -> Optional[str]:
    entry = get(test_id)
    if entry is None:
        return None
    if language == LANGUAGE_HINDI:
        return entry.measures_hi or None
    return entry.measures_en or None


def note_for(test_id: Optional[str], language: str) -> Optional[str]:
    entry = get(test_id)
    if entry is None:
        return None
    if language == LANGUAGE_HINDI:
        return entry.note_hi or None
    return entry.note_en or None


def references_for(test_id: Optional[str]) -> List[str]:
    entry = get(test_id)
    if entry is None:
        return []
    return list(entry.references)


def coverage() -> Dict[str, object]:
    """Which catalog tests have an entry, and which are missing."""

    catalog_ids = [test.id for test in catalog.TESTS]
    missing = [test_id for test_id in catalog_ids if test_id not in ENTRIES]
    extra = [test_id for test_id in ENTRIES if test_id not in set(catalog_ids)]
    covered = len(catalog_ids) - len(missing)
    return {
        "catalog_total": len(catalog_ids),
        "dictionary_total": len(ENTRIES),
        "covered": covered,
        "missing": missing,
        "extra": extra,
        "ratio": round(covered / len(catalog_ids), 4) if catalog_ids else 1.0,
    }
