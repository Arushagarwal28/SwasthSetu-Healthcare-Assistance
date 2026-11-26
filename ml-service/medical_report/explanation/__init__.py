"""Phase 3 - bilingual, rule-based explanation of parsed medical reports.

Public API::

    from medical_report.explanation import explain_report, explain_bilingual

    english = explain_report(parsed, "en")
    hindi = explain_report(parsed, "hi")
    both = explain_bilingual(parsed)

Everything here is offline and deterministic: a curated terminology dictionary,
bilingual wording templates and the values already extracted by Phase 2. No
diagnosis, no treatment advice, and no reference range is ever invented.
"""

from .engine import (
    ExplanationSafetyError,
    explain_bilingual,
    explain_report,
    explain_test,
)
from .provider import (
    ExplanationProvider,
    RuleBasedExplanationProvider,
    get_provider,
    reset_provider,
    set_provider,
)
from .references import REFERENCES, describe as describe_references, get_reference
from .terminology import ENTRIES, coverage, get as get_terminology
from .types import (
    LANGUAGE_ENGLISH,
    LANGUAGE_HINDI,
    LANGUAGES,
    ExplainedReport,
    ReportSummary,
    TerminologyEntry,
    TestExplanation,
)

__all__ = [
    "ENTRIES",
    "ExplanationProvider",
    "ExplanationSafetyError",
    "ExplainedReport",
    "LANGUAGES",
    "LANGUAGE_ENGLISH",
    "LANGUAGE_HINDI",
    "REFERENCES",
    "ReportSummary",
    "RuleBasedExplanationProvider",
    "TerminologyEntry",
    "TestExplanation",
    "coverage",
    "describe_references",
    "explain_bilingual",
    "explain_report",
    "explain_test",
    "get_provider",
    "get_reference",
    "get_terminology",
    "reset_provider",
    "set_provider",
]
