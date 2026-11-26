"""Decide what a file *is* from its bytes, never from its name.

The client-supplied filename and content type are untrusted, so the service
sniffs magic numbers before handing the bytes to any parser.
"""

from __future__ import annotations

from typing import Tuple

from medical_report.errors import UnsupportedFileType

PDF_MAGIC = b"%PDF-"

_IMAGE_SIGNATURES: Tuple[Tuple[bytes, str], ...] = (
    (b"\xff\xd8\xff", "jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"II*\x00", "tiff"),
    (b"MM\x00*", "tiff"),
    (b"BM", "bmp"),
)

SUPPORTED_DESCRIPTION = "PDF, JPEG, PNG, TIFF, BMP or WEBP"


def sniff_kind(head: bytes) -> str:
    """Return ``"pdf"`` or ``"image"``; raise for anything else."""
    if head.startswith(PDF_MAGIC):
        return "pdf"
    for signature, _name in _IMAGE_SIGNATURES:
        if head.startswith(signature):
            return "image"
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image"
    raise UnsupportedFileType(
        f"Only {SUPPORTED_DESCRIPTION} files are supported.",
        details={"magic": head[:8].hex()},
    )


def sniff_image_format(head: bytes) -> str:
    """Best-effort image format label, used only for reporting."""
    for signature, name in _IMAGE_SIGNATURES:
        if head.startswith(signature):
            return name
    if len(head) >= 12 and head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "webp"
    return "unknown"
