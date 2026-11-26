"""Unit recognition and normalisation.

Only spellings that were actually printed are normalised. An unknown unit is
kept verbatim with ``known=False`` - never replaced with a guessed unit.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, Optional

#: lower-cased, whitespace-free spelling -> canonical unit
_UNIT_ALIASES: Dict[str, str] = {
    "g/dl": "g/dL",
    "gm/dl": "g/dL",
    "g%": "g/dL",
    "gm%": "g/dL",
    "gram/dl": "g/dL",
    "mg/dl": "mg/dL",
    "mg%": "mg/dL",
    "mg/l": "mg/L",
    "ug/dl": "µg/dL",
    "mcg/dl": "µg/dL",
    "µg/dl": "µg/dL",
    "ug/l": "µg/L",
    "µg/l": "µg/L",
    "ng/ml": "ng/mL",
    "ng/dl": "ng/dL",
    "pg/ml": "pg/mL",
    "mmol/l": "mmol/L",
    "meq/l": "mEq/L",
    "mol/l": "mol/L",
    "u/l": "U/L",
    "iu/l": "IU/L",
    "iu/ml": "IU/mL",
    "uiu/ml": "µIU/mL",
    "µiu/ml": "µIU/mL",
    "miu/l": "mIU/L",
    "miu/ml": "mIU/mL",
    "fl": "fL",
    "pg": "pg",
    "%": "%",
    "percent": "%",
    "/ul": "/µL",
    "/µl": "/µL",
    "/cumm": "/µL",
    "/cu mm": "/µL",
    "cells/ul": "/µL",
    "cells/µl": "/µL",
    "cells/cumm": "/µL",
    "cells/mm3": "/µL",
    "/mm3": "/µL",
    "cu mm": "/µL",
    "10^3/ul": "10³/µL",
    "10^3/µl": "10³/µL",
    "x10^3/ul": "10³/µL",
    "x10^3/µl": "10³/µL",
    "thou/ul": "10³/µL",
    "thou/µl": "10³/µL",
    "lakh/ul": "lakh/µL",
    "lakh/µl": "lakh/µL",
    "lakhs/ul": "lakh/µL",
    "lakhs/µl": "lakh/µL",
    "lakh/cumm": "lakh/µL",
    "million/ul": "million/µL",
    "million/µl": "million/µL",
    "mill/ul": "million/µL",
    "mill/µl": "million/µL",
    "million/cumm": "million/µL",
    "mm/hr": "mm/hr",
    "mm/1hr": "mm/hr",
    "mm/hour": "mm/hr",
    "ml/min/1.73m2": "mL/min/1.73m²",
    "ml/min/1.73m²": "mL/min/1.73m²",
    "ml/min": "mL/min",
    "sec": "sec",
    "seconds": "sec",
    "/hpf": "/hpf",
    "cells/hpf": "/hpf",
    "hpf": "/hpf",
    "ratio": "ratio",
    "index": "index",
}

STOPWORDS = {
    "reference",
    "range",
    "remarks",
    "remark",
    "result",
    "results",
    "normal",
    "flag",
    "unit",
    "units",
    "value",
    "test",
    "method",
    "biological",
    "interval",
    "name",
    "patient",
}

#: Units may contain digits, slashes and symbols; plain words like "TSH" must
#: never be mistaken for a unit.
_SYMBOLIC = re.compile(r"^[A-Za-zµμ%][A-Za-z0-9µμ%./^*\-]{0,16}$")
_HAS_SYMBOL = re.compile(r"[/%^*]|\d")


@dataclass(slots=True)
class UnitMatch:
    raw: str
    normalized: str
    known: bool
    remainder: str = ""


def _key(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip()).replace("μ", "µ").casefold()


def normalize_unit(text: Optional[str]) -> UnitMatch:
    """Normalise one unit token; unknown units are preserved verbatim."""
    if text is None:
        return UnitMatch(raw="", normalized="", known=False)
    raw = text.strip()
    if not raw:
        return UnitMatch(raw="", normalized="", known=False)

    key = _key(raw).replace(" ", "")
    spaced = _key(raw)
    canonical = _UNIT_ALIASES.get(key) or _UNIT_ALIASES.get(spaced)
    if canonical:
        return UnitMatch(raw=raw, normalized=canonical, known=True)
    return UnitMatch(raw=raw, normalized=raw, known=False)


def looks_like_unit(text: str) -> bool:
    """True for symbol-bearing tokens only (``mg/dL``, ``/hpf``, ``10^3/uL``)."""
    candidate = text.strip().strip(",;")
    if not candidate or " " in candidate:
        return False
    if _key(candidate) in STOPWORDS:
        return False
    if not _SYMBOLIC.match(candidate):
        return False
    return bool(_HAS_SYMBOL.search(candidate))


def match_unit_prefix(text: str) -> Optional[UnitMatch]:
    """Match a unit at the start of ``text`` and return the leftover text."""
    stripped = text.strip()
    if not stripped:
        return None
    for size in range(1, len(stripped) + 1):
        token = stripped[:size]
        if size < len(stripped) and stripped[size] not in " \t":
            continue
        match = normalize_unit(token)
        if match.known:
            return UnitMatch(raw=match.raw, normalized=match.normalized, known=True, remainder=stripped[size:].strip())
        if looks_like_unit(token):
            return UnitMatch(raw=match.raw, normalized=match.normalized, known=False, remainder=stripped[size:].strip())
    return None


def canonical_for_definition(unit_normalized: Optional[str], expected_units) -> bool:
    """Whether a unit matches one the catalog lists for the test."""
    if not unit_normalized:
        return False
    return unit_normalized in expected_units
