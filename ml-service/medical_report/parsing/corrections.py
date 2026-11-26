"""Manual correction data structures.

A correction never overwrites the extracted original: the original stays in the
``extracted_*`` fields and every change is appended to ``corrections``.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, List, Optional, Sequence

from medical_report.parsing import catalog, classify, names, ranges, units, values
from medical_report.parsing.types import (
    STATUS_NEEDS_REVIEW,
    Correction,
    ParsedReport,
    ParsedTestResult,
)

SUPPORTED_FIELDS = ("value", "unit", "reference_range", "name")


@dataclass(slots=True)
class FieldCorrection:
    index: int
    field: str
    corrected: Any
    corrected_by: str
    corrected_at: str
    note: Optional[str] = None
    canonical_id: Optional[str] = None


def _recompute(test: ParsedTestResult) -> ParsedTestResult:
    parsed_value = values.parse_value(test.value_raw)
    definition = catalog.get(test.canonical_id) if test.canonical_id else None
    flag = classify.normalize_flag(test.lab_flag_raw)
    classification = classify.classify(parsed_value, test.reference, flag, definition)
    review = list(classification.review_reasons)
    return replace(
        test,
        value_numeric=parsed_value.numeric,
        value_qualitative=parsed_value.qualitative,
        status=classification.status,
        status_basis=classification.basis,
        status_reason=classification.reason,
        review_reasons=review,
        needs_review=classification.status == STATUS_NEEDS_REVIEW or bool(review),
    )


def _apply_one(test: ParsedTestResult, correction: FieldCorrection) -> ParsedTestResult:
    field = correction.field

    if field == "value":
        parsed = values.parse_value(str(correction.corrected))
        updated = replace(
            test,
            value_raw=(str(correction.corrected) if correction.corrected is not None else None),
            value_numeric=parsed.numeric,
            value_qualitative=parsed.qualitative,
        )
    elif field == "unit":
        text = str(correction.corrected) if correction.corrected is not None else None
        match = units.normalize_unit(text)
        updated = replace(
            test,
            unit_raw=match.raw or None,
            unit_normalized=match.normalized or None,
            unit_known=match.known,
        )
    elif field == "reference_range":
        text = str(correction.corrected) if correction.corrected is not None else None
        updated = replace(test, reference=ranges.parse(text))
    elif field == "name":
        text = str(correction.corrected)
        match = names.match(text, test.category)
        updated = replace(
            test,
            name_raw=text,
            name_normalized=match.normalized,
            name_match_method=match.method,
            name_match_score=match.score,
            canonical_id=match.definition.id if match.definition else None,
            canonical_name=names.display_name(text, match.definition),
            category=match.definition.category if match.definition else test.category,
        )
    else:
        raise ValueError(f"Unsupported correction field: {field}")

    updated = _recompute(updated)
    record = Correction(
        field=field,
        original=_original_for(test, field),
        corrected=correction.corrected,
        corrected_by=correction.corrected_by,
        corrected_at=correction.corrected_at,
        note=correction.note,
    )
    updated.corrections = list(test.corrections) + [record]
    return updated


def _original_for(test: ParsedTestResult, field: str) -> Any:
    if field == "value":
        return test.value_raw
    if field == "unit":
        return test.unit_raw
    if field == "reference_range":
        return test.reference.text_raw
    if field == "name":
        return test.name_raw
    return None


def apply_corrections(report: ParsedReport, corrections: Sequence[FieldCorrection]) -> ParsedReport:
    """Return a new report with corrections applied, originals preserved."""
    tests = list(report.tests)
    applied: List[Correction] = []
    warnings = list(report.warnings)

    for correction in corrections:
        if correction.field not in SUPPORTED_FIELDS:
            warnings.append(f"Correction ignored: unsupported field '{correction.field}'.")
            continue

        target_index = None
        for position, test in enumerate(tests):
            if test.index != correction.index:
                continue
            if correction.canonical_id and test.canonical_id != correction.canonical_id:
                continue
            target_index = position
            break

        if target_index is None:
            warnings.append(
                f"Correction ignored: no test result at index {correction.index}"
                + (f" with id '{correction.canonical_id}'." if correction.canonical_id else ".")
            )
            continue

        updated = _apply_one(tests[target_index], correction)
        tests[target_index] = updated
        applied.extend(updated.corrections[len(updated.corrections) - 1 :])

    return replace(
        report,
        tests=tests,
        corrections=list(report.corrections) + applied,
        warnings=warnings,
    )
