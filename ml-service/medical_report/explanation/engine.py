"""Public entry points for the Phase 3 explanation engine.

The engine is a pure read-only layer over a Phase 2 :class:`ParsedReport`:

* it never recomputes or overrides a status - it only describes the one that
  Phase 2 produced;
* it never rewrites a value, a unit or a reference range;
* it refuses to return output whose echoed data differs from the parsed report,
  and refuses output that changed the report itself.

That last check is what keeps a future LLM provider honest.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from ..parsing.types import ParsedReport, ParsedTestResult
from .provider import ExplanationProvider, get_provider
from .types import (
    LANGUAGE_ENGLISH,
    LANGUAGE_HINDI,
    LANGUAGES,
    ExplainedReport,
    ReportSummary,
    TestExplanation,
)


class ExplanationSafetyError(RuntimeError):
    """Raised when an explanation would misstate or mutate report data."""


def _check_language(language: str) -> str:
    normalised = (language or "").strip().lower()
    if normalised not in LANGUAGES:
        raise ValueError(
            f"unsupported language {language!r}; expected one of {', '.join(LANGUAGES)}"
        )
    return normalised


def _snapshot(test: ParsedTestResult) -> Dict[str, object]:
    return {
        "value_raw": test.value_raw,
        "value_numeric": test.value_numeric,
        "value_qualitative": test.value_qualitative,
        "unit_raw": test.unit_raw,
        "reference_text": test.reference.text_raw,
        "reference_kind": test.reference.kind,
        "lab_flag_raw": test.lab_flag_raw,
        "status": test.status,
    }


def explain_test(
    test: ParsedTestResult,
    language: str = LANGUAGE_ENGLISH,
    provider: Optional[ExplanationProvider] = None,
) -> TestExplanation:
    """Explain a single parsed result, without touching it."""

    language = _check_language(language)
    provider = provider or get_provider()
    if not provider.supports(language):
        raise ValueError(
            f"provider {provider.name!r} does not support language {language!r}"
        )

    before = _snapshot(test)
    explanation = provider.explain_test(test, language)
    after = _snapshot(test)

    if before != after:
        raise ExplanationSafetyError(
            "explanation provider modified the parsed result; refusing to return it"
        )
    if explanation.values_used and explanation.values_used != before:
        raise ExplanationSafetyError(
            "explanation quotes values that differ from the parsed result; refusing to "
            "return it"
        )
    if explanation.status != test.status:
        raise ExplanationSafetyError(
            "explanation changed the deterministic status; refusing to return it"
        )
    return explanation


def explain_report(
    report: ParsedReport,
    language: str = LANGUAGE_ENGLISH,
    provider: Optional[ExplanationProvider] = None,
) -> ExplainedReport:
    """Explain every result plus an overall summary, in one language."""

    language = _check_language(language)
    provider = provider or get_provider()
    if not provider.supports(language):
        raise ValueError(
            f"provider {provider.name!r} does not support language {language!r}"
        )

    before = report.to_dict()
    tests: List[TestExplanation] = [
        explain_test(test, language, provider) for test in report.tests
    ]
    summary: ReportSummary = provider.summarize(report, language, tests)
    after = report.to_dict()

    if before != after:
        raise ExplanationSafetyError(
            "explanation provider modified the parsed report; refusing to return it"
        )
    return ExplainedReport(
        language=language,
        summary=summary,
        tests=tests,
        provider=provider.name,
        document_id=report.document_id,
        warnings=list(report.warnings),
    )


def explain_bilingual(
    report: ParsedReport,
    provider: Optional[ExplanationProvider] = None,
) -> Dict[str, ExplainedReport]:
    """English and Hindi explanations for the same report, side by side."""

    return {
        LANGUAGE_ENGLISH: explain_report(report, LANGUAGE_ENGLISH, provider),
        LANGUAGE_HINDI: explain_report(report, LANGUAGE_HINDI, provider),
    }
