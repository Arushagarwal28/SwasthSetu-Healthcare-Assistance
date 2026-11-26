"""The extensible :class:`ExplanationProvider` interface and the default provider.

Phase 3 ships one implementation, :class:`RuleBasedExplanationProvider`, which
uses only the curated dictionary, the wording templates and the parsed report.
No network call, model download or third-party service is involved.

A future LLM provider can implement the same interface. It must obey the same
contract:

* it receives a :class:`~medical_report.parsing.types.ParsedTestResult` /
  :class:`~medical_report.parsing.types.ParsedReport` and must not modify it;
* it must not state a value, unit or range other than the ones on the report;
* it must not turn a ``NEEDS_REVIEW`` result into a finding;
* it must return the same :class:`TestExplanation` shape, so the safety checks in
  :mod:`medical_report.explanation.engine` still apply.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Sequence, Tuple

from ..parsing.types import (
    STATUS_ABNORMAL,
    STATUS_HIGH,
    STATUS_LOW,
    STATUS_NEEDS_REVIEW,
    STATUS_UNKNOWN,
    STATUS_WITHIN_RANGE,
    ParsedReport,
    ParsedTestResult,
)
from . import phrases, terminology
from .types import (
    LANGUAGE_ENGLISH,
    LANGUAGE_HINDI,
    LANGUAGES,
    ReportSummary,
    TestExplanation,
)


class ExplanationProvider(ABC):
    """Turns parsed results into patient-facing explanations in one language."""

    #: Human-readable provider name, echoed in the output.
    name: str = "provider"
    #: Languages this provider can produce.
    languages: Tuple[str, ...] = LANGUAGES

    def supports(self, language: str) -> bool:
        return language in self.languages

    @abstractmethod
    def explain_test(self, test: ParsedTestResult, language: str) -> TestExplanation:
        """Explain one result without changing any of its data."""

    @abstractmethod
    def summarize(
        self,
        report: ParsedReport,
        language: str,
        tests: Sequence[TestExplanation],
    ) -> ReportSummary:
        """Explain the report as a whole."""


_FIELD_LABELS: Dict[str, Dict[str, str]] = {
    "value": {"en": "value", "hi": "मान"},
    "unit": {"en": "unit", "hi": "इकाई"},
    "reference_range": {"en": "reference range", "hi": "संदर्भ सीमा"},
    "name": {"en": "test name", "hi": "जाँच का नाम"},
}


class RuleBasedExplanationProvider(ExplanationProvider):
    """Offline, template-driven explanation provider (the Phase 3 default)."""

    name = "rule-based"

    # ------------------------------------------------------------------ tests
    def explain_test(self, test: ParsedTestResult, language: str) -> TestExplanation:
        entry = terminology.get(test.canonical_id)
        known = entry is not None
        name = terminology.name_for(test.canonical_id, language, test.display_name)

        value_text = self._value_text(test)
        range_text = (
            test.reference.text_raw
            if test.reference.present and test.reference.text_raw
            else None
        )
        # Prefer the wording the laboratory printed ("Negative") over the internal
        # canonical token ("negative"), so the patient sees what the report says.
        expected = test.reference.text_raw or test.reference.qualitative_expected

        result_line = self._result_line(
            name, language, value_text=value_text, range_text=range_text
        )
        status_text = phrases.status_text(
            test.status,
            language,
            range_text=range_text,
            expected=expected,
            value_text=value_text,
        )

        note = terminology.note_for(test.canonical_id, language)
        if note is None and not known and test.status != STATUS_UNKNOWN:
            note = phrases.UNKNOWN_TEST_NOTE[language]
        interpretation = (
            f"{phrases.NOTE_LABEL[language]}: {note}" if note else None
        )

        return TestExplanation(
            index=test.index,
            canonical_id=test.canonical_id,
            name=name,
            category=test.category,
            status=test.status,
            status_label=phrases.status_label(test.status, language),
            known_test=known,
            measures=terminology.measures_for(test.canonical_id, language),
            result_line=result_line,
            status_text=status_text,
            interpretation_note=interpretation,
            correction_note=self._correction_note(test, language),
            caution=self._caution(test, language, known=known),
            review_reasons=list(test.review_reasons),
            values_used=self._values_used(test),
            references=terminology.references_for(test.canonical_id),
        )

    # ---------------------------------------------------------------- summary
    def summarize(
        self,
        report: ParsedReport,
        language: str,
        tests: Sequence[TestExplanation],
    ) -> ReportSummary:
        counts = {status: 0 for status in (
            STATUS_WITHIN_RANGE,
            STATUS_HIGH,
            STATUS_LOW,
            STATUS_ABNORMAL,
            STATUS_UNKNOWN,
            STATUS_NEEDS_REVIEW,
        )}
        for test in tests:
            counts[test.status] = counts.get(test.status, 0) + 1

        total = len(tests)
        outside = counts[STATUS_HIGH] + counts[STATUS_LOW] + counts[STATUS_ABNORMAL]

        if total:
            overview = phrases.SUMMARY_COUNTS[language].format(
                total=total,
                within=counts[STATUS_WITHIN_RANGE],
                outside=outside,
                unknown=counts[STATUS_UNKNOWN],
                review=counts[STATUS_NEEDS_REVIEW],
            )
        else:
            overview = phrases.SUMMARY_NO_TESTS[language]

        return ReportSummary(
            language=language,
            title=phrases.TITLES[language],
            overview=overview,
            counts=counts,
            total_tests=total,
            report_kind=self._report_kind(report, language),
            categories=self._categories(report, language, tests),
            key_points=self._key_points(language, counts, total, outside),
            next_steps=list(phrases.NEXT_STEPS[language]),
            disclaimers=list(phrases.DISCLAIMERS[language]),
        )

    # ---------------------------------------------------------------- helpers
    @staticmethod
    def _value_text(test: ParsedTestResult) -> Optional[str]:
        # A unit on its own is not a result: never imply a value that was not read.
        if not test.value_raw:
            return None
        parts = [test.value_raw]
        if test.unit_raw:
            parts.append(test.unit_raw)
        return " ".join(parts)

    @staticmethod
    def _result_line(
        name: str,
        language: str,
        *,
        value_text: Optional[str],
        range_text: Optional[str],
    ) -> str:
        if value_text is None:
            return phrases.RESULT_LINE_NO_VALUE[language].format(name=name)
        if range_text is None:
            return phrases.RESULT_LINE_NO_RANGE[language].format(
                name=name, value=value_text
            )
        return phrases.RESULT_LINE[language].format(
            name=name, value=value_text, range=range_text
        )

    @staticmethod
    def _values_used(test: ParsedTestResult) -> Dict[str, object]:
        """An exact copy of the report-derived data this explanation relies on."""

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

    def _correction_note(self, test: ParsedTestResult, language: str) -> Optional[str]:
        if not test.corrections:
            return None
        sentences: List[str] = []
        for correction in test.corrections:
            label = _FIELD_LABELS.get(correction.field, {}).get(
                language, correction.field
            )
            sentences.append(
                phrases.CORRECTION_NOTE[language].format(
                    field=label,
                    old=correction.original,
                    new=correction.corrected,
                )
            )
        return " ".join(sentences)

    def _caution(
        self, test: ParsedTestResult, language: str, *, known: bool
    ) -> Optional[str]:
        sentences: List[str] = []

        for reason in test.review_reasons:
            template = phrases.REASON_TEXT.get(reason)
            if template is None:
                sentences.append(phrases.REASON_FALLBACK[language].format(reason=reason))
                continue
            sentences.append(
                template[language].format(
                    primary=test.verification.primary_reading
                    or test.value_raw
                    or "?",
                    secondary=test.verification.secondary_reading or "?",
                    unit=test.unit_raw or "?",
                )
            )

        if test.status == STATUS_UNKNOWN and test.value_raw is None:
            missing = phrases.REASON_TEXT["value_missing"][language]
            if missing not in sentences:
                sentences.append(missing)

        if not sentences:
            return None
        heading = phrases.REVIEW_HEADING[language]
        return f"{heading}: " + " ".join(sentences)

    def _report_kind(self, report: ParsedReport, language: str) -> str:
        detected = report.report.detected or [report.report.primary]
        labels = ", ".join(
            phrases.category_label(item, language) for item in detected
        )
        if report.report.mixed:
            return f"{phrases.MIXED_LABELS[language]}: {labels}"
        return f"{phrases.REPORT_KIND_LABELS[language]}: {labels}"

    def _categories(
        self,
        report: ParsedReport,
        language: str,
        tests: Sequence[TestExplanation],
    ) -> List[str]:
        ordered: List[str] = []
        for item in (report.report.detected or [report.report.primary]):
            if item not in ordered:
                ordered.append(item)
        for test in tests:
            if test.category not in ordered:
                ordered.append(test.category)
        return [phrases.category_label(item, language) for item in ordered]

    def _key_points(
        self,
        language: str,
        counts: Dict[str, int],
        total: int,
        outside: int,
    ) -> List[str]:
        points: List[str] = []
        if not total:
            return points
        if outside:
            points.append(phrases.KEY_POINT_OUTSIDE[language].format(count=outside))
        elif (
            counts[STATUS_WITHIN_RANGE]
            and not counts[STATUS_UNKNOWN]
            and not counts[STATUS_NEEDS_REVIEW]
        ):
            # Only claim that everything is inside the range when every result
            # was actually classified; otherwise the unknown/review points below
            # already say what is still unchecked.
            points.append(phrases.KEY_POINT_ALL_WITHIN[language])
        if counts[STATUS_UNKNOWN]:
            points.append(
                phrases.KEY_POINT_UNKNOWN[language].format(count=counts[STATUS_UNKNOWN])
            )
        if counts[STATUS_NEEDS_REVIEW]:
            points.append(
                phrases.KEY_POINT_REVIEW[language].format(
                    count=counts[STATUS_NEEDS_REVIEW]
                )
            )
        return points


_DEFAULT_PROVIDER: ExplanationProvider = RuleBasedExplanationProvider()


def get_provider() -> ExplanationProvider:
    """The provider used when none is passed explicitly."""

    return _DEFAULT_PROVIDER


def set_provider(provider: ExplanationProvider) -> None:
    """Install a different provider (for example a future LLM implementation)."""

    global _DEFAULT_PROVIDER
    if not isinstance(provider, ExplanationProvider):
        raise TypeError("provider must be an ExplanationProvider instance")
    _DEFAULT_PROVIDER = provider


def reset_provider() -> None:
    """Restore the offline rule-based provider."""

    global _DEFAULT_PROVIDER
    _DEFAULT_PROVIDER = RuleBasedExplanationProvider()
