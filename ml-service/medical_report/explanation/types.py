"""Data structures for bilingual report explanations.

These objects are **new** values derived from a :class:`ParsedReport`. Nothing in
this module may write back into the parsed report, so an explanation can never
change a value, a unit, a reference range or a deterministic classification.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

LANGUAGE_ENGLISH = "en"
LANGUAGE_HINDI = "hi"
LANGUAGES = (LANGUAGE_ENGLISH, LANGUAGE_HINDI)

LANGUAGE_LABELS: Dict[str, str] = {
    LANGUAGE_ENGLISH: "English",
    LANGUAGE_HINDI: "हिन्दी",
}


@dataclass(frozen=True, slots=True)
class TerminologyEntry:
    """Curated, non-diagnostic description of one canonical laboratory test.

    ``measures_*`` says what the test measures. It deliberately contains no
    reference range, no threshold and no diagnosis, because the only range this
    system may ever use is the one printed on the patient's own report.
    """

    test_id: str
    name_en: str
    name_hi: str
    measures_en: str
    measures_hi: str
    note_en: str = ""
    note_hi: str = ""
    references: Tuple[str, ...] = ("medlineplus-lab-tests",)


@dataclass(slots=True)
class TestExplanation:
    """Explanation of a single parsed result, in one language."""

    index: int
    canonical_id: Optional[str]
    name: str
    category: str
    status: str
    status_label: str
    known_test: bool
    measures: Optional[str]
    result_line: str
    status_text: str
    interpretation_note: Optional[str]
    correction_note: Optional[str]
    caution: Optional[str]
    review_reasons: List[str]
    values_used: Dict[str, Any]
    references: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "canonical_id": self.canonical_id,
            "name": self.name,
            "category": self.category,
            "status": self.status,
            "status_label": self.status_label,
            "known_test": self.known_test,
            "measures": self.measures,
            "result_line": self.result_line,
            "status_text": self.status_text,
            "interpretation_note": self.interpretation_note,
            "correction_note": self.correction_note,
            "caution": self.caution,
            "review_reasons": list(self.review_reasons),
            "values_used": dict(self.values_used),
            "references": list(self.references),
        }

    def render(self) -> str:
        """A readable block, used by the CLI preview and by tests."""

        lines = [f"- {self.result_line}"]
        if self.measures:
            lines.append(f"  {self.measures}")
        lines.append(f"  {self.status_label}: {self.status_text}")
        if self.interpretation_note:
            lines.append(f"  {self.interpretation_note}")
        if self.correction_note:
            lines.append(f"  {self.correction_note}")
        if self.caution:
            lines.append(f"  ! {self.caution}")
        return "\n".join(lines)


@dataclass(slots=True)
class ReportSummary:
    """The overall, non-diagnostic summary of a whole report."""

    language: str
    title: str
    overview: str
    counts: Dict[str, int]
    total_tests: int
    report_kind: str
    categories: List[str]
    key_points: List[str]
    next_steps: List[str]
    disclaimers: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "language": self.language,
            "title": self.title,
            "overview": self.overview,
            "counts": dict(self.counts),
            "total_tests": self.total_tests,
            "report_kind": self.report_kind,
            "categories": list(self.categories),
            "key_points": list(self.key_points),
            "next_steps": list(self.next_steps),
            "disclaimers": list(self.disclaimers),
        }

    def render(self) -> str:
        lines = [self.title, "", self.overview]
        if self.categories:
            lines.append("")
            lines.extend(f"* {item}" for item in self.categories)
        if self.key_points:
            lines.append("")
            lines.extend(f"* {item}" for item in self.key_points)
        if self.next_steps:
            lines.append("")
            lines.extend(f"* {item}" for item in self.next_steps)
        if self.disclaimers:
            lines.append("")
            lines.extend(f"> {item}" for item in self.disclaimers)
        return "\n".join(lines)


@dataclass(slots=True)
class ExplainedReport:
    """A summary plus one explanation per parsed result."""

    language: str
    summary: ReportSummary
    tests: List[TestExplanation]
    provider: str
    document_id: Optional[str] = None
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "language": self.language,
            "provider": self.provider,
            "document_id": self.document_id,
            "summary": self.summary.to_dict(),
            "tests": [test.to_dict() for test in self.tests],
            "warnings": list(self.warnings),
        }

    def render(self) -> str:
        blocks = [self.summary.render(), ""]
        blocks.extend(test.render() for test in self.tests)
        return "\n".join(blocks)
