"""Deterministic status classification.

Only information that the report itself provides (value, printed range, lab
flag) plus the catalog's declared qualitative convention is used. A numeric
result without a printed range is ``UNKNOWN``; nothing is inferred from
general medical knowledge.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

from medical_report.parsing.catalog import TestDefinition
from medical_report.parsing.types import (
    STATUS_ABNORMAL,
    STATUS_HIGH,
    STATUS_LOW,
    STATUS_NEEDS_REVIEW,
    STATUS_UNKNOWN,
    STATUS_WITHIN_RANGE,
    ParsedRange,
)
from medical_report.parsing.values import ABNORMAL_QUALITATIVE, ParsedValue

_FLAG_STATUS = {
    "high": STATUS_HIGH,
    "low": STATUS_LOW,
    "abnormal": STATUS_ABNORMAL,
    "normal": STATUS_WITHIN_RANGE,
}

INCOMPARABLE = "INCOMPARABLE"


@dataclass(slots=True)
class Classification:
    status: str
    basis: str
    reason: str
    review_reasons: List[str] = field(default_factory=list)


def normalize_flag(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    lowered = text.strip().casefold()
    return {
        "h": "high",
        "high": "high",
        "↑": "high",
        "hh": "high",
        "l": "low",
        "low": "low",
        "↓": "low",
        "ll": "low",
        "a": "abnormal",
        "abn": "abnormal",
        "abnormal": "abnormal",
        "*": "abnormal",
        "critical": "abnormal",
        "n": "normal",
        "normal": "normal",
        "wnl": "normal",
    }.get(lowered)


def compare(value: ParsedValue, reference: Optional[ParsedRange]) -> Optional[str]:
    """Return WITHIN_RANGE/HIGH/LOW/INCOMPARABLE, or ``None`` when incomparable."""
    if reference is None or not reference.present or value.numeric is None:
        return None
    if reference.kind not in ("interval", "upper", "lower"):
        return None

    comparator = value.comparator or ""
    if comparator in (">", ">=", "≥") and reference.kind == "upper":
        return INCOMPARABLE
    if comparator in ("<", "<=", "≤") and reference.kind == "lower":
        return INCOMPARABLE

    number = value.numeric
    if reference.kind == "interval":
        if reference.low is not None:
            if number < reference.low:
                return STATUS_LOW
        if reference.high is not None:
            if number > reference.high:
                return STATUS_HIGH
        return STATUS_WITHIN_RANGE

    if reference.kind == "upper" and reference.high is not None:
        inside = number <= reference.high if reference.high_inclusive else number < reference.high
        return STATUS_WITHIN_RANGE if inside else STATUS_HIGH

    if reference.kind == "lower" and reference.low is not None:
        inside = number >= reference.low if reference.low_inclusive else number > reference.low
        return STATUS_WITHIN_RANGE if inside else STATUS_LOW

    return None


def _flag_agrees(flag: str, computed: str) -> bool:
    """Whether a printed laboratory flag is consistent with the range result."""
    if flag == "high":
        return computed == STATUS_HIGH
    if flag == "low":
        return computed == STATUS_LOW
    if flag == "abnormal":
        return computed in (STATUS_HIGH, STATUS_LOW, STATUS_ABNORMAL)
    if flag == "normal":
        return computed == STATUS_WITHIN_RANGE
    return True


def _numeric_reason(value: ParsedValue, reference: ParsedRange, status: str) -> str:
    shown = value.raw or str(value.numeric)
    if status == STATUS_WITHIN_RANGE:
        return f"Reported {shown}; printed reference range is {reference.describe()}."
    if status == STATUS_HIGH:
        return f"Reported {shown}, above the printed reference range {reference.describe()}."
    return f"Reported {shown}, below the printed reference range {reference.describe()}."


def _qualitative(value: ParsedValue, expected: Optional[str], basis: str) -> Classification:
    if expected is None:
        return Classification(
            STATUS_UNKNOWN,
            "no_reference_range",
            "No reference value is printed for this qualitative result.",
        )
    if value.qualitative == expected:
        return Classification(
            STATUS_WITHIN_RANGE,
            basis,
            f"Reported '{value.raw}', which matches the expected result '{expected}'.",
        )
    if value.qualitative in ABNORMAL_QUALITATIVE:
        return Classification(
            STATUS_ABNORMAL,
            basis,
            f"Reported '{value.raw}', which differs from the expected result '{expected}'.",
        )
    return Classification(
        STATUS_NEEDS_REVIEW,
        "qualitative_not_interpretable",
        f"Reported '{value.raw}' could not be compared with the expected result '{expected}'.",
        ["qualitative_value_not_interpretable"],
    )


def classify(
    value: ParsedValue,
    reference: Optional[ParsedRange],
    flag: Optional[str],
    definition: Optional[TestDefinition],
) -> Classification:
    if value.kind == "missing":
        return Classification(
            STATUS_UNKNOWN,
            "no_value",
            "No result value was extracted for this test.",
            ["value_missing"],
        )

    if value.kind == "unparsed":
        detail = value.warning or "value_not_cleanly_numeric"
        return Classification(
            STATUS_NEEDS_REVIEW,
            "unreadable_value",
            f"The reported value '{value.raw}' could not be read reliably.",
            [detail],
        )

    if value.kind == "numeric":
        computed = compare(value, reference)
        if computed == INCOMPARABLE:
            return Classification(
                STATUS_NEEDS_REVIEW,
                "comparator_prevents_comparison",
                "The reported value uses a comparator that cannot be compared with the printed range.",
                ["comparator_prevents_comparison"],
            )
        if computed is not None:
            if flag is not None and not _flag_agrees(flag, computed):
                return Classification(
                    STATUS_NEEDS_REVIEW,
                    "flag_range_conflict",
                    "The laboratory flag and the printed reference range disagree.",
                    ["lab_flag_conflicts_with_reference_range"],
                )
            return Classification(computed, "reference_range", _numeric_reason(value, reference, computed))
        if flag is not None:
            status = _FLAG_STATUS[flag]
            return Classification(
                status,
                "lab_flag",
                f"Laboratory marked this result as '{flag}'.",
            )
        return Classification(
            STATUS_UNKNOWN,
            "no_reference_range",
            "No reference range was printed and no laboratory flag was given.",
        )

    # Qualitative value.
    printed_expected = None
    if reference is not None and reference.kind == "qualitative":
        printed_expected = reference.qualitative_expected
    if printed_expected is not None:
        return _qualitative(value, printed_expected, "printed_qualitative_reference")
    if definition is not None and definition.qualitative_expected is not None:
        return _qualitative(value, definition.qualitative_expected, "catalog_expected_value")
    return Classification(
        STATUS_UNKNOWN,
        "no_reference_range",
        "No reference value is printed for this qualitative result.",
    )
