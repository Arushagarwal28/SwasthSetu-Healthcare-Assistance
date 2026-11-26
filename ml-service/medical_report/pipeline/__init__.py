"""Document extraction pipeline: load -> (digital text | render -> OCR) -> layout."""

from medical_report.pipeline.extract import extract_document

__all__ = ["extract_document"]
