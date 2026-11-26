"""Reference-range parsing.

Supports the forms laboratories actually print: ``12.0 - 15.0``, ``12-15``,
``Up to 200``, ``< 150``, ``> 40`` and qualitative targets such as
``Negative``. Anything else stays unparsed, so the result becomes ``UNKNOWN``
rather than being compared against a guessed range.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from medical_report.parsing.types import ParsedRange
from medical_report.parsing.values import _to_float

_NUM = r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:[.,]\d+)?"

_INTERVAL = re.compile(rf"({_NUM})\s*(?:-|–|—|to|--)\s*({_NUM})", re.IGNORECASE)
_UPPER = re.compile(
    rf"(?:<=|<|≤|up\s*to|upto|not\s+more\s+than|less\s+than|max(?:imum)?(?:\s+of)?)\s*({_NUM})",
    re.IGNORECASE,
)
_LOWER = re.compile(
    rf"(?:>=|>|≥|more\s+than|greater\s+than|min(?:imum)?(?:\s+of)?)\s*({_NUM})",
    re.IGNORECASE,
)

_QUALITATIVE = {
    "negative": "negative",
    "neg": "negative",
    "absent": "negative",
    "nil": "negative",
    "not detected": "negative",
    "no growth": "negative",
    "normal": "normal",
}


@dataclass(slots=True)
class RangeExtraction:
    range: ParsedRange
    remainder: str


def _exclusive(text: str) -> bool:
    return "<" in text or "≤" in text or ">" in text or "≥" in text


def extract_range(text: Optional[str]) -> Optional[RangeExtraction]:
    """Find a reference range inside ``text`` and return what is left over."""
    if not text:
        return None
    source = text.strip()
    if not source:
        return None

    interval = _INTERVAL.search(source)
    if interval:
        low, _ = _to_float(interval.group(1))
        high, _ = _to_float(interval.group(2))
        if low is not None and high is not None:
            remainder = (source[: interval.start()] + " " + source[interval.end() :]).strip()
            return RangeExtraction(
                ParsedRange(
                    kind="interval",
                    low=min(low, high),
                    high=max(low, high),
                    text_raw=interval.group(0).strip(),
                ),
                remainder,
            )

    upper = _UPPER.search(source)
    if upper:
        high, _ = _to_float(upper.group(1))
        if high is not None:
            remainder = (source[: upper.start()] + " " + source[upper.end() :]).strip()
            return RangeExtraction(
                ParsedRange(
                    kind="upper",
                    high=high,
                    high_inclusive=not _exclusive(upper.group(0)),
                    text_raw=upper.group(0).strip(),
                ),
                remainder,
            )

    lower = _LOWER.search(source)
    if lower:
        low, _ = _to_float(lower.group(1))
        if low is not None:
            remainder = (source[: lower.start()] + " " + source[lower.end() :]).strip()
            return RangeExtraction(
                ParsedRange(
                    kind="lower",
                    low=low,
                    low_inclusive=not _exclusive(lower.group(0)),
                    text_raw=lower.group(0).strip(),
                ),
                remainder,
            )

    key = re.sub(r"\s+", " ", source.casefold()).strip()
    if key in _QUALITATIVE:
        return RangeExtraction(
            ParsedRange(kind="qualitative", text_raw=source.strip(), qualitative_expected=_QUALITATIVE[key]),
            remainder="",
        )

    return None


def parse(text: Optional[str]) -> ParsedRange:
    extraction = extract_range(text)
    if extraction is None:
        return ParsedRange(kind="unknown", text_raw=(text.strip() if text else None))
    return extraction.range
