"""Tests for the ExplanationProvider interface, registry and safety gates."""

from __future__ import annotations

from dataclasses import replace

import pytest

from medical_report.explanation import (
    ExplanationProvider,
    ExplanationSafetyError,
    RuleBasedExplanationProvider,
    explain_bilingual,
    explain_report,
    get_provider,
    reset_provider,
    set_provider,
)
from medical_report.parsing import parse_document
from medical_report.testing import reports


@pytest.fixture(autouse=True)
def restore_provider():
    yield
    reset_provider()


def parsed(name: str = "cbc"):
    return parse_document(reports.build_document(reports.REPORTS[name]))


class TaggingProvider(RuleBasedExplanationProvider):
    """Marks every explanation so tests can see the provider was used."""

    name = "tagging"

    def __init__(self):
        self.test_calls = 0
        self.summary_calls = 0

    def explain_test(self, test, language):
        self.test_calls += 1
        explanation = super().explain_test(test, language)
        return replace(explanation, status_text=f"[stub] {explanation.status_text}")

    def summarize(self, report, language, tests):
        self.summary_calls += 1
        return super().summarize(report, language, tests)


def test_default_provider_is_the_offline_rule_based_one():
    provider = get_provider()

    assert isinstance(provider, RuleBasedExplanationProvider)
    assert provider.name == "rule-based"
    assert provider.supports("en") and provider.supports("hi")
    assert not provider.supports("fr")


def test_interface_cannot_be_instantiated():
    with pytest.raises(TypeError):
        ExplanationProvider()  # type: ignore[abstract]


def test_custom_provider_is_used_when_registered():
    provider = TaggingProvider()
    set_provider(provider)

    explained = explain_report(parsed("glucose"), "en")

    assert explained.provider == "tagging"
    assert all(test.status_text.startswith("[stub]") for test in explained.tests)
    assert provider.test_calls == 3
    assert provider.summary_calls == 1


def test_reset_restores_the_rule_based_provider():
    set_provider(TaggingProvider())
    reset_provider()

    explained = explain_report(parsed("cbc"), "en")

    assert explained.provider == "rule-based"
    assert not explained.tests[0].status_text.startswith("[stub]")


def test_set_provider_rejects_objects_that_are_not_providers():
    with pytest.raises(TypeError):
        set_provider(object())  # type: ignore[arg-type]


def test_provider_limited_to_english_rejects_hindi():
    class EnglishOnly(RuleBasedExplanationProvider):
        name = "english-only"
        languages = ("en",)

    set_provider(EnglishOnly())

    assert explain_report(parsed("cbc"), "en").provider == "english-only"
    with pytest.raises(ValueError):
        explain_report(parsed("cbc"), "hi")


def test_provider_that_modifies_the_report_is_rejected():
    class MutatingProvider(RuleBasedExplanationProvider):
        name = "mutating"

        def explain_test(self, test, language):
            explanation = super().explain_test(test, language)
            test.value_raw = "999"
            return explanation

    set_provider(MutatingProvider())

    with pytest.raises(ExplanationSafetyError):
        explain_report(parsed("cbc"), "en")


def test_provider_that_misquotes_the_value_is_rejected():
    class LyingProvider(RuleBasedExplanationProvider):
        name = "lying"

        def explain_test(self, test, language):
            explanation = super().explain_test(test, language)
            values = dict(explanation.values_used)
            values["value_raw"] = "999"
            return replace(explanation, values_used=values)

    set_provider(LyingProvider())

    with pytest.raises(ExplanationSafetyError):
        explain_report(parsed("cbc"), "en")


def test_provider_that_overrides_the_status_is_rejected():
    class StatusChangingProvider(RuleBasedExplanationProvider):
        name = "status-changing"

        def explain_test(self, test, language):
            explanation = super().explain_test(test, language)
            return replace(explanation, status="LOW")

    set_provider(StatusChangingProvider())

    with pytest.raises(ExplanationSafetyError):
        explain_report(parsed("cbc"), "en")


def test_bilingual_uses_the_registered_provider_for_both_languages():
    set_provider(TaggingProvider())
    both = explain_bilingual(parsed("cbc"))

    assert both["en"].provider == both["hi"].provider == "tagging"
    assert both["hi"].tests[0].status_text.startswith("[stub]")
