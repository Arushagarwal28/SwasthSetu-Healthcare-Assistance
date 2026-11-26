"""Rebuild parsing objects from their JSON form.

Phase 4 stores parsed results in a database and later asks this service to
re-classify a correction or to regenerate explanations. Both need the same
:class:`~medical_report.parsing.types.ParsedTestResult` the parser would have
produced, so this module reverses :meth:`to_dict` exactly.

The deserializer is deliberately tolerant about omitted optional fields but
strict about anything that could silently change a medical meaning:

* an unknown ``status`` is rejected rather than defaulted;
* a non-numeric value where a number is expected is rejected;
* absurdly large payloads are rejected.

Nothing here invents a value, a unit or a reference range: a missing field stays
``None`` and is classified as missing/unknown downstream.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence

from medical_report.parsing.corrections import FieldCorrection, SUPPORTED_FIELDS
from medical_report.parsing.types import (
    STATUSES,
    Correction,
    ParsedRange,
    ParsedReport,
    ParsedTestResult,
    ReportTypeResult,
    SourceRef,
    Verification,
)

MAX_TESTS = 200
MAX_TEXT = 500
MAX_CORRECTIONS = 50


class PayloadError(ValueError):
    """Raised when a stored result payload cannot be trusted."""


def _mapping(value: Any, what: str) -> Dict[str, Any]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise PayloadError(f"{what} must be an object")
    return value


def _text(value: Any, what: str, *, limit: int = MAX_TEXT) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise PayloadError(f"{what} must be text")
    text = str(value)
    if len(text) > limit:
        raise PayloadError(f"{what} is longer than {limit} characters")
    return text


def _number(value: Any, what: str) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise PayloadError(f"{what} must be a number")
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise PayloadError(f"{what} must be a number") from exc


def _boolean(value: Any, default: bool = False) -> bool:
    return default if value is None else bool(value)


def _texts(value: Any) -> List[str]:
    if not value:
        return []
    if not isinstance(value, (list, tuple)):
        raise PayloadError("expected a list of text values")
    out: List[str] = []
    for item in value:
        text = _text(item, "list item")
        if text is not None:
            out.append(text)
    return out


def source_from_dict(data: Any) -> SourceRef:
    raw = _mapping(data, "source")
    bbox = raw.get("bbox")
    return SourceRef(
        page_index=int(_number(raw.get("page_index"), "source.page_index") or 0),
        line_index=int(_number(raw.get("line_index"), "source.line_index") or 0),
        row_index=int(_number(raw.get("row_index"), "source.row_index") or 0),
        page_source=_text(raw.get("page_source"), "source.page_source") or "pdf_text",
        bbox={str(key): float(value) for key, value in _mapping(bbox, "source.bbox").items()},
    )


def reference_from_dict(data: Any) -> ParsedRange:
    raw = _mapping(data, "reference")
    kind = _text(raw.get("kind"), "reference.kind") or "unknown"
    if kind not in ("interval", "upper", "lower", "qualitative", "unknown"):
        raise PayloadError("reference.kind is not recognised")
    return ParsedRange(
        kind=kind,
        low=_number(raw.get("low"), "reference.low"),
        high=_number(raw.get("high"), "reference.high"),
        low_inclusive=_boolean(raw.get("low_inclusive"), True),
        high_inclusive=_boolean(raw.get("high_inclusive"), True),
        text_raw=_text(raw.get("text_raw"), "reference.text_raw"),
        qualitative_expected=_text(raw.get("qualitative_expected"), "reference.qualitative_expected"),
    )


def verification_from_dict(data: Any) -> Verification:
    raw = _mapping(data, "verification")
    return Verification(
        checked=_boolean(raw.get("checked")),
        primary_reading=_text(raw.get("primary_reading"), "verification.primary_reading"),
        secondary_reading=_text(raw.get("secondary_reading"), "verification.secondary_reading"),
        agreement=_text(raw.get("agreement"), "verification.agreement") or "not_checked",
        languages=tuple(_texts(raw.get("languages"))),
    )


def correction_from_dict(data: Any) -> Correction:
    raw = _mapping(data, "correction")
    return Correction(
        field=_text(raw.get("field"), "correction.field") or "",
        original=raw.get("original"),
        corrected=raw.get("corrected"),
        corrected_by=_text(raw.get("corrected_by"), "correction.corrected_by") or "",
        corrected_at=_text(raw.get("corrected_at"), "correction.corrected_at") or "",
        note=_text(raw.get("note"), "correction.note"),
    )


def test_from_dict(data: Any, fallback_index: int = 0) -> ParsedTestResult:
    raw = _mapping(data, "test")
    status = _text(raw.get("status"), "test.status") or "UNKNOWN"
    if status not in STATUSES:
        raise PayloadError("test.status is not recognised")

    name_match = _mapping(raw.get("name_match"), "test.name_match")
    extracted = _mapping(raw.get("extracted"), "test.extracted")

    index = int(_number(raw.get("index"), "test.index") or fallback_index)
    canonical_name = _text(raw.get("canonical_name"), "test.canonical_name")
    name_raw = _text(raw.get("name_raw"), "test.name_raw")
    if not canonical_name and not name_raw:
        raise PayloadError("a test result needs a canonical_name or a name_raw")

    return ParsedTestResult(
        index=index,
        canonical_id=_text(raw.get("canonical_id"), "test.canonical_id"),
        canonical_name=canonical_name or name_raw or "",
        category=_text(raw.get("category"), "test.category") or "other",
        name_raw=name_raw or canonical_name or "",
        name_normalized=_text(raw.get("name_normalized"), "test.name_normalized") or "",
        name_match_method=_text(name_match.get("method"), "test.name_match.method") or "unknown",
        name_match_score=_number(name_match.get("score"), "test.name_match.score") or 0.0,
        extracted_value_raw=_text(extracted.get("value_raw"), "test.extracted.value_raw"),
        extracted_value_numeric=_number(extracted.get("value_numeric"), "test.extracted.value_numeric"),
        extracted_unit_raw=_text(extracted.get("unit_raw"), "test.extracted.unit_raw"),
        extracted_reference_text=_text(extracted.get("reference_text"), "test.extracted.reference_text"),
        value_raw=_text(raw.get("value_raw"), "test.value_raw"),
        value_numeric=_number(raw.get("value_numeric"), "test.value_numeric"),
        value_qualitative=_text(raw.get("value_qualitative"), "test.value_qualitative"),
        unit_raw=_text(raw.get("unit_raw"), "test.unit_raw"),
        unit_normalized=_text(raw.get("unit_normalized"), "test.unit_normalized"),
        unit_known=_boolean(raw.get("unit_known")),
        reference=reference_from_dict(raw.get("reference")),
        lab_flag_raw=_text(raw.get("lab_flag_raw"), "test.lab_flag_raw"),
        status=status,
        status_basis=_text(raw.get("status_basis"), "test.status_basis") or "unknown",
        status_reason=_text(raw.get("status_reason"), "test.status_reason") or "",
        confidence=_number(raw.get("confidence"), "test.confidence") or 0.0,
        needs_review=_boolean(raw.get("needs_review")),
        review_reasons=_texts(raw.get("review_reasons")),
        verification=verification_from_dict(raw.get("verification")),
        source=source_from_dict(raw.get("source")),
        corrections=[correction_from_dict(item) for item in (raw.get("corrections") or [])],
    )


def tests_from_list(items: Any) -> List[ParsedTestResult]:
    if items is None:
        return []
    if not isinstance(items, (list, tuple)):
        raise PayloadError("tests must be a list")
    if len(items) > MAX_TESTS:
        raise PayloadError(f"a payload may contain at most {MAX_TESTS} test results")
    return [test_from_dict(item, position) for position, item in enumerate(items)]


def report_from_dict(payload: Any) -> ParsedReport:
    """Rebuild a whole parsed report from a stored JSON payload."""
    raw = _mapping(payload, "payload")
    report_raw = _mapping(raw.get("report"), "payload.report")
    unparsed = raw.get("unparsed_lines") or []
    if not isinstance(unparsed, (list, tuple)):
        raise PayloadError("unparsed_lines must be a list")

    detected = _texts(report_raw.get("detected"))
    primary = _text(report_raw.get("primary"), "report.primary") or (detected[0] if detected else "other")

    return ParsedReport(
        document_id=_text(raw.get("document_id"), "document_id"),
        report=ReportTypeResult(
            primary=primary,
            detected=detected,
            mixed=_boolean(report_raw.get("mixed")),
            confidence=_number(report_raw.get("confidence"), "report.confidence") or 0.0,
            evidence=list(report_raw.get("evidence") or []),
        ),
        tests=tests_from_list(raw.get("tests")),
        unparsed_lines=[dict(item) for item in unparsed if isinstance(item, dict)],
        corrections=[correction_from_dict(item) for item in (raw.get("corrections") or [])],
        warnings=_texts(raw.get("warnings")),
        stats=dict(raw.get("stats") or {}),
    )


def corrections_from_request(items: Any, *, default_actor: str = "system") -> List[FieldCorrection]:
    if not isinstance(items, (list, tuple)) or not items:
        raise PayloadError("corrections must be a non-empty list")
    if len(items) > MAX_CORRECTIONS:
        raise PayloadError(f"a request may contain at most {MAX_CORRECTIONS} corrections")

    out: List[FieldCorrection] = []
    for item in items:
        raw = _mapping(item, "correction")
        field = _text(raw.get("field"), "correction.field") or ""
        if field not in SUPPORTED_FIELDS:
            raise PayloadError("correction field is not supported")
        if "corrected" not in raw:
            raise PayloadError("a correction needs a 'corrected' value")
        corrected = raw.get("corrected")
        if isinstance(corrected, (dict, list)):
            raise PayloadError("a corrected value must be scalar")
        index = _number(raw.get("index"), "correction.index")
        if index is None or index < 0:
            raise PayloadError("a correction needs a non-negative index")
        out.append(
            FieldCorrection(
                index=int(index),
                field=field,
                corrected=corrected,
                corrected_by=_text(raw.get("corrected_by"), "correction.corrected_by") or default_actor,
                corrected_at=_text(raw.get("corrected_at"), "correction.corrected_at") or "",
                note=_text(raw.get("note"), "correction.note"),
                canonical_id=_text(raw.get("canonical_id"), "correction.canonical_id"),
            )
        )
    return out


def correction_result(applied: Sequence[Correction]) -> List[Dict[str, Any]]:
    return [item.to_dict() for item in applied]


def assert_within_limits(tests: Iterable[ParsedTestResult]) -> None:
    count = 0
    for _ in tests:
        count += 1
    if count > MAX_TESTS:
        raise PayloadError(f"a payload may contain at most {MAX_TESTS} test results")
