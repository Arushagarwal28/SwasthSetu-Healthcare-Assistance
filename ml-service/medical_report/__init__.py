"""SwasthSetu medical report extraction service (Phase 1: OCR only).

This package is intentionally independent of ``ml-service/main.py`` (the
disease-prediction service). It extracts *structure and text* from a report
document; it performs no clinical interpretation, no diagnosis and no
prescription. Explanation of results belongs to a later phase.
"""

__all__ = ["__version__"]

__version__ = "1.0.0"
