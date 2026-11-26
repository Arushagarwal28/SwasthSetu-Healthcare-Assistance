"""Structured parsing of extracted medical reports (Phase 2).

This layer turns positioned text (Phase 1) into test results. It never invents
a value, unit or reference range: anything missing stays missing and is
classified ``UNKNOWN`` or ``NEEDS_REVIEW``.
"""

from medical_report.parsing.corrections import FieldCorrection, apply_corrections
from medical_report.parsing.parser import parse_document, parse_document_file

__all__ = ["FieldCorrection", "apply_corrections", "parse_document", "parse_document_file"]
