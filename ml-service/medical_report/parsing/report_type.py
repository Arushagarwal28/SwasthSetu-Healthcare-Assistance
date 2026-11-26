"""Report-type detection from section headings and the tests that were parsed."""

from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from medical_report.parsing.types import CATEGORY_LABELS, ParsedTestResult, ReportTypeResult

_HEADER_PHRASES: Tuple[Tuple[str, str], ...] = tuple(
    sorted(
        (
            ("complete blood count", "cbc"),
            ("complete blood picture", "cbc"),
            ("haemogram", "cbc"),
            ("hemogram", "cbc"),
            ("cbc", "cbc"),
            ("blood count", "cbc"),
            ("blood sugar", "glucose"),
            ("blood glucose", "glucose"),
            ("glucose profile", "glucose"),
            ("diabetes profile", "glucose"),
            ("sugar profile", "glucose"),
            ("glycated hemoglobin", "hba1c"),
            ("glycated haemoglobin", "hba1c"),
            ("glycosylated hemoglobin", "hba1c"),
            ("hba1c", "hba1c"),
            ("lipid profile", "lipid"),
            ("cholesterol profile", "lipid"),
            ("lipid", "lipid"),
            ("liver function test", "lft"),
            ("liver function", "lft"),
            ("liver profile", "lft"),
            ("hepatic profile", "lft"),
            ("lft", "lft"),
            ("kidney function test", "kft"),
            ("kidney function", "kft"),
            ("renal function test", "kft"),
            ("renal function", "kft"),
            ("renal profile", "kft"),
            ("kidney profile", "kft"),
            ("kft", "kft"),
            ("rft", "kft"),
            ("thyroid profile", "thyroid"),
            ("thyroid function test", "thyroid"),
            ("thyroid function", "thyroid"),
            ("tft", "thyroid"),
            ("urine routine examination", "urine"),
            ("urine routine", "urine"),
            ("urine examination", "urine"),
            ("urine analysis", "urine"),
            ("urinalysis", "urine"),
            ("complete urine examination", "urine"),
            ("urine test", "urine"),
        ),
        key=lambda item: len(item[0]),
        reverse=True,
    )
)


_PANEL_GROUPS = {"hba1c": "glucose"}


def detect_section_header(text: str) -> Optional[str]:
    """Return the category a section heading announces, if any."""
    candidate = re.sub(r"\s+", " ", (text or "")).strip(" :-")
    if not candidate or len(candidate) > 60:
        return None
    if any(char.isdigit() for char in candidate):
        return None

    lowered = candidate.casefold().strip(" :")
    for phrase, category in _HEADER_PHRASES:
        if lowered != phrase and not lowered.startswith(phrase + " "):
            continue
        letters = [char for char in candidate if char.isalpha()]
        upper_ratio = sum(1 for char in letters if char.isupper()) / max(len(letters), 1)
        if lowered == phrase or upper_ratio >= 0.8:
            return category
    return None


def detect_report_types(
    tests: Sequence[ParsedTestResult],
    header_events: Sequence[Dict[str, Any]],
) -> ReportTypeResult:
    scores: Dict[str, float] = defaultdict(float)
    evidence: List[Dict[str, Any]] = []

    for test in tests:
        if test.canonical_id and test.category in CATEGORY_LABELS:
            scores[test.category] += 1.0

    for event in header_events:
        category = event.get("category")
        if category in CATEGORY_LABELS:
            scores[category] += 3.0
            evidence.append(
                {
                    "category": category,
                    "reason": "section_header",
                    "detail": event.get("text", ""),
                    "page_index": event.get("page_index"),
                }
            )

    total = sum(scores.values())
    ordered = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    detected = [category for category, score in ordered if score > 0]

    if not detected:
        return ReportTypeResult(
            primary="other",
            detected=[],
            mixed=False,
            confidence=0.0,
            evidence=[],
        )

    primary = ordered[0][0]
    for category, score in ordered:
        if category == "other":
            continue
        evidence.append({"category": category, "reason": "test_count", "detail": f"{int(score)} signal(s)"})
        if len(evidence) >= 20:
            break

    confidence = round(min(0.99, scores[primary] / total), 3) if total else 0.0
    resolvable = [category for category in detected if category != "other"]

    # HbA1c is part of the glucose/diabetes panel, not a separate report type.
    groups = {_PANEL_GROUPS.get(category, category) for category in resolvable}

    return ReportTypeResult(
        primary=primary,
        detected=detected,
        mixed=len(groups) >= 2,
        confidence=confidence,
        evidence=evidence[:20],
    )
