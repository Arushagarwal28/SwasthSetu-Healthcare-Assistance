"""Data structures for parsed medical reports."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

#: Everything a single test result can be labelled with.
STATUS_WITHIN_RANGE = "WITHIN_RANGE"
STATUS_HIGH = "HIGH"
STATUS_LOW = "LOW"
STATUS_ABNORMAL = "ABNORMAL"
STATUS_UNKNOWN = "UNKNOWN"
STATUS_NEEDS_REVIEW = "NEEDS_REVIEW"

STATUSES = (
    STATUS_WITHIN_RANGE,
    STATUS_HIGH,
    STATUS_LOW,
    STATUS_ABNORMAL,
    STATUS_UNKNOWN,
    STATUS_NEEDS_REVIEW,
)

#: Canonical categories supported in Phase 2.
CATEGORY_LABELS: Dict[str, str] = {
    "cbc": "Complete Blood Count",
    "glucose": "Blood Glucose",
    "hba1c": "HbA1c",
    "lipid": "Lipid Profile",
    "lft": "Liver Function Test",
    "kft": "Kidney Function Test",
    "thyroid": "Thyroid Profile",
    "urine": "Urine Routine Examination",
    "other": "Other",
}


def _round(value: Optional[float], digits: int = 3) -> Optional[float]:
    return None if value is None else round(float(value), digits)


@dataclass(slots=True)
class SourceRef:
    """Where a result came from, so a human can check the original line."""

    page_index: int
    line_index: int
    row_index: int
    page_source: str  # "pdf_text" | "ocr"
    bbox: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page_index": self.page_index,
            "line_index": self.line_index,
            "row_index": self.row_index,
            "page_source": self.page_source,
            "bbox": {key: _round(value, 2) for key, value in self.bbox.items()},
        }


@dataclass(slots=True)
class ParsedRange:
    """A reference range exactly as printed, or an explicit absence of one."""

    kind: str = "unknown"  # interval | upper | lower | qualitative | unknown
    low: Optional[float] = None
    high: Optional[float] = None
    low_inclusive: bool = True
    high_inclusive: bool = True
    text_raw: Optional[str] = None
    qualitative_expected: Optional[str] = None

    @property
    def present(self) -> bool:
        return self.kind != "unknown"

    def describe(self) -> str:
        if self.kind == "interval":
            return f"{self.low}-{self.high}"
        if self.kind == "upper":
            return ("<=" if self.high_inclusive else "<") + f" {self.high}"
        if self.kind == "lower":
            return (">=" if self.low_inclusive else ">") + f" {self.low}"
        if self.kind == "qualitative":
            return str(self.qualitative_expected)
        return "not printed"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "kind": self.kind,
            "low": _round(self.low),
            "high": _round(self.high),
            "low_inclusive": self.low_inclusive,
            "high_inclusive": self.high_inclusive,
            "text_raw": self.text_raw,
            "qualitative_expected": self.qualitative_expected,
        }


@dataclass(slots=True)
class Verification:
    """Result of re-reading a number with the English OCR model."""

    checked: bool = False
    primary_reading: Optional[str] = None
    secondary_reading: Optional[str] = None
    agreement: str = "not_checked"  # not_checked | match | mismatch | unavailable
    languages: Tuple[str, ...] = ()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "checked": self.checked,
            "primary_reading": self.primary_reading,
            "secondary_reading": self.secondary_reading,
            "agreement": self.agreement,
            "languages": list(self.languages),
        }


@dataclass(slots=True)
class Correction:
    """One manual correction; the extracted original is never overwritten."""

    field: str
    original: Any
    corrected: Any
    corrected_by: str
    corrected_at: str
    note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field": self.field,
            "original": self.original,
            "corrected": self.corrected,
            "corrected_by": self.corrected_by,
            "corrected_at": self.corrected_at,
            "note": self.note,
        }


@dataclass(slots=True)
class ParsedTestResult:
    index: int
    canonical_id: Optional[str]
    canonical_name: str
    category: str
    name_raw: str
    name_normalized: str
    name_match_method: str
    name_match_score: float

    # Original extraction - never modified by corrections.
    extracted_value_raw: Optional[str]
    extracted_value_numeric: Optional[float]
    extracted_unit_raw: Optional[str]
    extracted_reference_text: Optional[str]

    # Effective values (equal to the extracted ones until a correction is applied).
    value_raw: Optional[str]
    value_numeric: Optional[float]
    value_qualitative: Optional[str]
    unit_raw: Optional[str]
    unit_normalized: Optional[str]
    unit_known: bool
    reference: ParsedRange
    lab_flag_raw: Optional[str]

    status: str
    status_basis: str
    status_reason: str
    confidence: float
    needs_review: bool
    review_reasons: List[str]
    verification: Verification
    source: SourceRef
    corrections: List[Correction] = field(default_factory=list)

    @property
    def display_name(self) -> str:
        return self.canonical_name or self.name_raw

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "canonical_id": self.canonical_id,
            "canonical_name": self.canonical_name,
            "category": self.category,
            "name_raw": self.name_raw,
            "name_normalized": self.name_normalized,
            "name_match": {"method": self.name_match_method, "score": round(self.name_match_score, 3)},
            "extracted": {
                "value_raw": self.extracted_value_raw,
                "value_numeric": _round(self.extracted_value_numeric, 4),
                "unit_raw": self.extracted_unit_raw,
                "reference_text": self.extracted_reference_text,
            },
            "value_raw": self.value_raw,
            "value_numeric": _round(self.value_numeric, 4),
            "value_qualitative": self.value_qualitative,
            "unit_raw": self.unit_raw,
            "unit_normalized": self.unit_normalized,
            "unit_known": self.unit_known,
            "reference": self.reference.to_dict(),
            "lab_flag_raw": self.lab_flag_raw,
            "status": self.status,
            "status_basis": self.status_basis,
            "status_reason": self.status_reason,
            "confidence": round(self.confidence, 1),
            "needs_review": self.needs_review,
            "review_reasons": list(self.review_reasons),
            "verification": self.verification.to_dict(),
            "source": self.source.to_dict(),
            "corrections": [item.to_dict() for item in self.corrections],
        }


@dataclass(slots=True)
class ReportTypeResult:
    primary: str
    detected: List[str]
    mixed: bool
    confidence: float
    evidence: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary": self.primary,
            "primary_label": CATEGORY_LABELS.get(self.primary, self.primary),
            "detected": list(self.detected),
            "detected_labels": [CATEGORY_LABELS.get(item, item) for item in self.detected],
            "mixed": self.mixed,
            "confidence": round(self.confidence, 3),
            "evidence": self.evidence,
        }


@dataclass(slots=True)
class ParsedReport:
    document_id: Optional[str]
    report: ReportTypeResult
    tests: List[ParsedTestResult]
    unparsed_lines: List[Dict[str, Any]]
    corrections: List[Correction]
    warnings: List[str]
    stats: Dict[str, Any]

    @property
    def needs_review(self) -> List[ParsedTestResult]:
        return [test for test in self.tests if test.needs_review]

    def by_canonical_id(self, canonical_id: str) -> Optional[ParsedTestResult]:
        for test in self.tests:
            if test.canonical_id == canonical_id:
                return test
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": True,
            "document_id": self.document_id,
            "report": self.report.to_dict(),
            "tests": [test.to_dict() for test in self.tests],
            "unparsed_lines": self.unparsed_lines,
            "corrections": [item.to_dict() for item in self.corrections],
            "warnings": self.warnings,
            "stats": self.stats,
        }
