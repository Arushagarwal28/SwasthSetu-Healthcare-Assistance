"""Typed errors for the OCR service.

Every error carries a stable machine code plus an HTTP status so the API layer
can answer with one predictable envelope:

    {"success": false, "error": {"code": ..., "message": ..., "details": {...}}}
"""

from __future__ import annotations

from typing import Any, Dict, Optional


class ExtractionError(Exception):
    """Base class for every expected failure while handling a document."""

    code = "extraction_error"
    status_code = 422

    def __init__(
        self,
        message: str,
        *,
        code: Optional[str] = None,
        status_code: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        self.details: Dict[str, Any] = details or {}


class InvalidRequest(ExtractionError):
    code = "invalid_request"
    status_code = 422


class UnsupportedFileType(ExtractionError):
    code = "unsupported_file_type"
    status_code = 415


class FileTooLarge(ExtractionError):
    code = "file_too_large"
    status_code = 413


class EmptyDocument(ExtractionError):
    code = "empty_document"
    status_code = 422


class DocumentUnreadable(ExtractionError):
    code = "document_unreadable"
    status_code = 422


class EncryptedDocument(DocumentUnreadable):
    code = "encrypted_document"


class InvalidLanguage(ExtractionError):
    code = "invalid_language"
    status_code = 422


class OcrUnavailable(ExtractionError):
    code = "ocr_unavailable"
    status_code = 503


class OcrFailed(ExtractionError):
    code = "ocr_failed"
    status_code = 500


def translate_pdf_error(exc: BaseException) -> ExtractionError:
    """Map a third-party PDF exception onto one of our typed errors.

    Exception text is deliberately not echoed back: library messages can embed
    absolute paths or document fragments.
    """
    name = type(exc).__name__
    message = str(exc).lower()
    if "password" in name.lower() or "password" in message or "encrypted" in message:
        return EncryptedDocument(
            "The PDF is password protected. Please upload an unlocked copy.",
            details={"reason": name},
        )
    return DocumentUnreadable(
        "The file could not be read as a valid PDF.",
        details={"reason": name},
    )
