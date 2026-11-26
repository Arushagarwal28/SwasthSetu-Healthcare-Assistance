"""Result-value parsing.

Deliberately conservative: text that cannot be read unambiguously is returned
as ``unparsed`` (never silently repaired), so the caller can mark it
``NEEDS_REVIEW`` instead of inventing a number.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

_NUM = r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:[.,]\d+)?"
_COMPARATOR = r"(?:<=|>=|<|>|≤|≥)"

#: A standalone number inside a cell (``Vitamin B12`` must not split at "12").
VALUE_TOKEN = re.compile(rf"(?<![A-Za-z0-9])({_COMPARATOR}?\s*{_NUM})(?![A-Za-z0-9])")
FULL_NUMBER = re.compile(rf"^({_COMPARATOR})?\s*({_NUM})$")
RANGE_LIKE = re.compile(rf"^\s*{_NUM}\s*(?:-|–|—|to)\s*{_NUM}\s*$")

QUALITATIVE_CANONICAL: Tuple[Tuple[Tuple[str, ...], str], ...] = (
    (("negative", "neg", "nil", "absent", "not detected", "not seen", "no growth"), "negative"),
    (("positive", "pos", "present", "detected", "reactive"), "positive"),
    (("trace", "traces"), "trace"),
    (("1+", "one plus", "1 plus"), "1+"),
    (("2+", "two plus", "2 plus"), "2+"),
    (("3+", "three plus", "3 plus"), "3+"),
    (("4+", "four plus", "4 plus"), "4+"),
    (("normal", "within normal limits", "wnl"), "normal"),
    (("clear",), "clear"),
    (("turbid", "cloudy", "hazy"), "turbid"),
    (("pale yellow", "straw", "straw coloured", "straw colored"), "pale yellow"),
    (("yellow", "yellowish"), "yellow"),
    (("few", "occasional", "rare"), "few"),
    (("many", "plenty", "numerous", "abundant"), "many"),
)

_QUALITATIVE_LOOKUP: Dict[str, str] = {}
for _terms, _canonical in QUALITATIVE_CANONICAL:
    for _term in _terms:
        _QUALITATIVE_LOOKUP[_term] = _canonical

ABNORMAL_QUALITATIVE = {"positive", "trace", "1+", "2+", "3+", "4+"}


@dataclass(slots=True)
class ParsedValue:
    kind: str  # numeric | qualitative | unparsed | missing
    raw: Optional[str]
    numeric: Optional[float] = None
    comparator: Optional[str] = None
    qualitative: Optional[str] = None
    warning: Optional[str] = None


def _to_float(text: str) -> Tuple[Optional[float], Optional[str]]:
    """Parse a numeric string, tolerating thousands and decimal commas."""
    candidate = text.strip().replace(" ", "")
    warning: Optional[str] = None

    if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", candidate):
        candidate = candidate.replace(",", "")
    elif "," in candidate and "." not in candidate:
        candidate = candidate.replace(",", ".")
        warning = "decimal_comma"
    elif "," in candidate and "." in candidate:
        if candidate.rfind(",") > candidate.rfind("."):
            candidate = candidate.replace(".", "").replace(",", ".")
        else:
            candidate = candidate.replace(",", "")
        warning = "mixed_separators"
    try:
        return float(candidate), warning
    except ValueError:
        return None, "not_a_number"


def parse_value(text: Optional[str]) -> ParsedValue:
    if text is None:
        return ParsedValue(kind="missing", raw=None)
    raw = text.strip()
    if not raw:
        return ParsedValue(kind="missing", raw=None)

    cleaned = raw.strip().strip(",;")
    numeric_match = FULL_NUMBER.match(cleaned)
    if numeric_match:
        comparator = (numeric_match.group(1) or "").strip() or None
        number, warning = _to_float(numeric_match.group(2))
        if number is None:
            return ParsedValue(kind="unparsed", raw=raw, warning=warning)
        return ParsedValue(kind="numeric", raw=raw, numeric=number, comparator=comparator, warning=warning)

    key = re.sub(r"\s+", " ", cleaned.casefold())
    if key in _QUALITATIVE_LOOKUP:
        return ParsedValue(kind="qualitative", raw=raw, qualitative=_QUALITATIVE_LOOKUP[key])

    # A bare "+"/"++" is a graded positivity marker in urine reports.
    if re.fullmatch(r"\+{1,4}", key):
        return ParsedValue(kind="qualitative", raw=raw, qualitative=f"{len(key)}+")

    if RANGE_LIKE.match(cleaned):
        return ParsedValue(kind="unparsed", raw=raw, warning="value_looks_like_a_range")

    if any(char.isdigit() for char in cleaned):
        return ParsedValue(kind="unparsed", raw=raw, warning="value_not_cleanly_numeric")

    return ParsedValue(kind="qualitative", raw=raw, qualitative=key[:60])


def to_float(text: str) -> Optional[float]:
    """Public helper used by cross-verification."""
    match = FULL_NUMBER.match(text.strip())
    if match:
        return _to_float(match.group(2))[0]
    value, _ = _to_float(text)
    return value
