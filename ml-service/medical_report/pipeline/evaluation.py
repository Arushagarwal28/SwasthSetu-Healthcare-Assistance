"""Text comparison metrics.

Used only to *measure* extraction accuracy against synthetic fixtures. Nothing
here is part of the request path.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Iterable, List, Sequence, Union

_NON_WORDS = re.compile(r"[^0-9a-z\u0900-\u097F]+")
_WHITESPACE = re.compile(r"\s+")

TextLike = Union[str, Sequence[str]]


def normalize_text(value: TextLike) -> str:
    """Lowercase, keep alphanumerics and Devanagari, collapse whitespace."""
    if not isinstance(value, str):
        value = " ".join(str(part) for part in value)
    lowered = value.casefold()
    cleaned = _NON_WORDS.sub(" ", lowered)
    return _WHITESPACE.sub(" ", cleaned).strip()


def tokens(value: TextLike) -> List[str]:
    normalized = normalize_text(value)
    return normalized.split() if normalized else []


def _levenshtein(reference: Sequence[str], hypothesis: Sequence[str]) -> int:
    if not reference:
        return len(hypothesis)
    if not hypothesis:
        return len(reference)
    previous = list(range(len(hypothesis) + 1))
    for row, ref_item in enumerate(reference, start=1):
        current = [row]
        for column, hyp_item in enumerate(hypothesis, start=1):
            cost = 0 if ref_item == hyp_item else 1
            current.append(
                min(
                    previous[column] + 1,
                    current[column - 1] + 1,
                    previous[column - 1] + cost,
                )
            )
        previous = current
    return previous[-1]


def character_error_rate(reference: TextLike, hypothesis: TextLike) -> float:
    ref = normalize_text(reference).replace(" ", "")
    hyp = normalize_text(hypothesis).replace(" ", "")
    if not ref:
        return 0.0 if not hyp else 1.0
    return min(1.0, _levenshtein(list(ref), list(hyp)) / len(ref))


def word_error_rate(reference: TextLike, hypothesis: TextLike) -> float:
    ref = tokens(reference)
    hyp = tokens(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    return min(1.0, _levenshtein(ref, hyp) / len(ref))


def word_recall(reference: TextLike, hypothesis: TextLike) -> float:
    """Fraction of reference words that appear in the hypothesis (multiset)."""
    ref = tokens(reference)
    if not ref:
        return 1.0
    hyp = Counter(tokens(hypothesis))
    matched = 0
    for word in ref:
        if hyp.get(word, 0) > 0:
            hyp[word] -= 1
            matched += 1
    return matched / len(ref)


def word_precision(reference: TextLike, hypothesis: TextLike) -> float:
    ref = Counter(tokens(reference))
    hyp = tokens(hypothesis)
    if not hyp:
        return 0.0
    matched = 0
    for word in hyp:
        if ref.get(word, 0) > 0:
            ref[word] -= 1
            matched += 1
    return matched / len(hyp)


def token_f1(reference: TextLike, hypothesis: TextLike) -> float:
    precision = word_precision(reference, hypothesis)
    recall = word_recall(reference, hypothesis)
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def devanagari_ratio(value: str) -> float:
    if not value:
        return 0.0
    devanagari = sum(1 for char in value if "\u0900" <= char <= "\u097F")
    visible = sum(1 for char in value if not char.isspace())
    return devanagari / visible if visible else 0.0


def summarize(reference: TextLike, hypothesis: TextLike) -> dict:
    return {
        "cer": round(character_error_rate(reference, hypothesis), 4),
        "wer": round(word_error_rate(reference, hypothesis), 4),
        "recall": round(word_recall(reference, hypothesis), 4),
        "precision": round(word_precision(reference, hypothesis), 4),
        "f1": round(token_f1(reference, hypothesis), 4),
    }


def normalize_all(values: Iterable[str]) -> List[str]:
    return [normalize_text(value) for value in values]
