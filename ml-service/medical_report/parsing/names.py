"""Test-name normalisation and catalog matching.

Handles abbreviations, punctuation, parenthetical expansions, specimen
qualifiers and light fuzzy matching for OCR typos. Ambiguity is reported, never
guessed.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from medical_report.parsing import catalog
from medical_report.parsing.catalog import TestDefinition

_SPECIMEN_QUALIFIERS = {
    "serum",
    "plasma",
    "blood",
    "whole",
    "edta",
    "sample",
    "s",
    "level",
    "levels",
    "conc",
    "concentration",
}

_KEEP_SPACES = re.compile(r"[^0-9a-z\u0900-\u097F]+")
_PARENS = re.compile(r"\(([^)]*)\)")

FUZZY_MIN_SCORE = 0.86


def normalize(text: str) -> str:
    lowered = text.casefold().replace("μ", "µ")
    cleaned = _KEEP_SPACES.sub(" ", lowered)
    return re.sub(r"\s+", " ", cleaned).strip()


def variants(text: str) -> Tuple[str, ...]:
    """All normalised spellings worth trying for one printed name."""
    base = normalize(text)
    parts: List[str] = []
    if base:
        parts.append(base)

    # "Hemoglobin (Hb)" -> also "hemoglobin hb" and "hemoglobin"
    for inner in _PARENS.findall(text):
        inner_norm = normalize(inner)
        if inner_norm and base:
            parts.append(normalize(f"{_PARENS.sub(' ', text)} {inner_norm}"))
    without_parens = normalize(_PARENS.sub(" ", text))
    if without_parens:
        parts.append(without_parens)

    expanded: List[str] = []
    for part in parts:
        expanded.append(part)
        tokens = part.split()
        stripped = [token for token in tokens if token not in _SPECIMEN_QUALIFIERS]
        if stripped and len(stripped) != len(tokens):
            expanded.append(" ".join(stripped))
        # drop a trailing "%"-style marker already removed by normalisation

    seen: Dict[str, None] = {}
    for part in expanded:
        if part:
            seen.setdefault(part, None)
    return tuple(seen)


def _build_index() -> Dict[str, List[TestDefinition]]:
    index: Dict[str, List[TestDefinition]] = {}
    for definition in catalog.TESTS:
        aliases = list(definition.aliases) + list(definition.hindi_aliases)
        for alias in aliases:
            index.setdefault(normalize(alias), []).append(definition)
    return index


_ALIAS_INDEX = _build_index()
_ALL_ALIASES = tuple(_ALIAS_INDEX.keys())


@dataclass(slots=True)
class NameMatch:
    definition: Optional[TestDefinition]
    score: float
    method: str  # alias | alias_variant | hindi | fuzzy | ambiguous | unknown
    normalized: str
    candidates: Tuple[str, ...] = ()


def _pick(candidates: Sequence[TestDefinition], category_hint: Optional[str]) -> Optional[TestDefinition]:
    unique = {candidate.id: candidate for candidate in candidates}
    if len(unique) == 1:
        return next(iter(unique.values()))
    if category_hint:
        narrowed = [item for item in unique.values() if item.category == category_hint]
        if len(narrowed) == 1:
            return narrowed[0]
    return None


def match(name_text: str, category_hint: Optional[str] = None) -> NameMatch:
    """Resolve a printed test name to a catalog entry."""
    normalized = normalize(name_text)
    if not normalized:
        return NameMatch(None, 0.0, "unknown", normalized)

    for variant in variants(name_text):
        candidates = _ALIAS_INDEX.get(variant)
        if not candidates:
            continue
        chosen = _pick(candidates, category_hint)
        if chosen is not None:
            method = "hindi" if variant != normalized and _is_hindi(variant) else "alias"
            return NameMatch(chosen, 1.0, method, variant)
        names = tuple(sorted({item.name for item in candidates}))
        return NameMatch(None, 0.0, "ambiguous", variant, names)

    # Fuzzy: only for reasonably long names, to avoid "Hb" matching "WBC".
    best_score = 0.0
    best_alias = ""
    if len(normalized) >= 4:
        for alias in _ALL_ALIASES:
            if abs(len(alias) - len(normalized)) > 6:
                continue
            if alias[:1] != normalized[:1]:
                continue
            score = difflib.SequenceMatcher(None, normalized, alias).ratio()
            if score > best_score:
                best_score, best_alias = score, alias
    if best_score >= FUZZY_MIN_SCORE:
        candidates = _ALIAS_INDEX.get(best_alias, [])
        chosen = _pick(candidates, category_hint)
        if chosen is not None:
            return NameMatch(chosen, round(best_score, 3), "fuzzy", best_alias)

    return NameMatch(None, 0.0, "unknown", normalized)


def _is_hindi(text: str) -> bool:
    return any("\u0900" <= char <= "\u097F" for char in text)


def display_name(name_text: str, definition: Optional[TestDefinition]) -> str:
    if definition is not None:
        return definition.name
    cleaned = re.sub(r"\s+", " ", name_text).strip(" :-")
    return cleaned[:1].upper() + cleaned[1:] if cleaned else "Unknown test"
