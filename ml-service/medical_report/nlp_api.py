"""Internal endpoints for corrections and bilingual explanations.

These routes are only reachable by the Node backend: the service binds to
loopback and every non-public route requires the shared internal token.

Both routes work on a *stored* parsed result (the JSON shape produced by
:meth:`ParsedReport.to_dict`), so they never need the original document. That is
what lets SwasthSetu delete every uploaded file immediately after parsing while
still being able to re-classify a correction or regenerate the explanation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from medical_report.errors import InvalidRequest
from medical_report.explanation.engine import ExplanationSafetyError, explain_bilingual, explain_report
from medical_report.parsing.corrections import apply_corrections
from medical_report.parsing.serialize import (
    PayloadError,
    corrections_from_request,
    report_from_dict,
)

router = APIRouter(tags=["nlp"])

_LANGUAGES = ("en", "hi", "both")


class ReportPayload(BaseModel):
    """A stored parsed report plus the operation to run on it."""

    document_id: Optional[str] = Field(default=None, description="Opaque caller supplied id")
    language: str = Field(default="both", description="en, hi or both")
    report: Dict[str, Any] = Field(default_factory=dict)
    tests: List[Dict[str, Any]] = Field(default_factory=list)
    corrections: List[Dict[str, Any]] = Field(default_factory=list)


class CorrectionPayload(ReportPayload):
    """A stored parsed report plus the corrections to apply to it."""

    tests: List[Dict[str, Any]] = Field(default_factory=list)
    corrections: List[Dict[str, Any]] = Field(default_factory=list)


def _language(value: str) -> str:
    normalised = (value or "").strip().lower()
    if normalised not in _LANGUAGES:
        raise InvalidRequest("language must be one of en, hi or both.")
    return normalised


def _explanations(payload: Any, language: str):
    report = report_from_dict(payload)
    if language == "both":
        return {name: value.to_dict() for name, value in explain_bilingual(report).items()}
    explained = explain_report(report, language)
    return {language: explained.to_dict()}


@router.post("/explain")
def explain(request: Request, body: ReportPayload) -> Dict[str, Any]:
    """Bilingual explanations for already-parsed results. Never re-reads a file."""
    language = _language(body.language)
    try:
        explanations = _explanations(body.model_dump(), language)
    except PayloadError as exc:
        raise InvalidRequest(str(exc)) from exc
    except ExplanationSafetyError as exc:
        raise InvalidRequest(str(exc)) from exc

    provider = next(iter(explanations.values()))["provider"]
    return {
        "success": True,
        "provider": provider,
        "languages": list(explanations.keys()),
        "explanations": explanations,
        "request_id": getattr(request.state, "request_id", None),
    }


@router.post("/correct")
def correct(request: Request, body: CorrectionPayload) -> Dict[str, Any]:
    """Apply manual corrections, recompute statuses deterministically, explain again.

    The extracted originals are preserved: a correction only changes the
    effective value and appends an audit record to ``corrections``.
    """
    language = _language(body.language)
    try:
        corrections = corrections_from_request(body.corrections)
        report = report_from_dict(body.model_dump())
        existing = {id(record) for test in report.tests for record in test.corrections}
        updated = apply_corrections(report, corrections)
        explanations = (
            {name: value.to_dict() for name, value in explain_bilingual(updated).items()}
            if language == "both"
            else {language: explain_report(updated, language).to_dict()}
        )
    except PayloadError as exc:
        raise InvalidRequest(str(exc)) from exc
    except ExplanationSafetyError as exc:
        raise InvalidRequest(str(exc)) from exc

    # Report which row each applied correction belongs to, so the caller can
    # persist the audit trail against the right stored result.
    applied = [
        dict(record.to_dict(), index=test.index)
        for test in updated.tests
        for record in test.corrections
        if id(record) not in existing
    ]
    return {
        "success": True,
        "provider": next(iter(explanations.values()))["provider"],
        "tests": [test.to_dict() for test in updated.tests],
        "applied": applied,
        "applied_count": len(applied),
        "warnings": list(updated.warnings),
        "explanations": explanations,
        "request_id": getattr(request.state, "request_id", None),
    }
