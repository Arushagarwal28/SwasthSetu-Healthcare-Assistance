"""Turn PDF pages and image files into grayscale numpy arrays for OCR."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps


def _require_pdfium():
    try:
        import pypdfium2 as pdfium  # noqa: WPS433 (optional at import time)
    except ImportError as exc:  # pragma: no cover - dependency is pinned
        raise RuntimeError("pypdfium2 is required to process PDF files") from exc
    return pdfium


def open_document(path: str):
    """Open a PDF with pdfium; the caller owns the returned handle."""
    pdfium = _require_pdfium()
    return pdfium.PdfDocument(str(path))


def document_page_count(document) -> int:
    return len(document)


def pdf_page_count(path: str) -> int:
    document = open_document(path)
    try:
        return len(document)
    finally:
        document.close()


def _page_size(page) -> Tuple[float, float]:
    """Page size in points, tolerating pypdfium2 API differences."""
    get_size = getattr(page, "get_size", None)
    if callable(get_size):
        width, height = get_size()
        return float(width), float(height)
    return float(page.get_width()), float(page.get_height())


def _bitmap_to_pil(bitmap) -> Image.Image:
    to_pil = getattr(bitmap, "to_pil", None)
    if callable(to_pil):
        return to_pil()
    # Older pypdfium2 releases expose a raw buffer instead.
    mode = "RGBA" if getattr(bitmap, "mode", "") == "BGRA" else "RGB"
    raw_mode = "BGRA" if mode == "RGBA" else "BGR"
    return Image.frombytes(mode, (bitmap.width, bitmap.height), bytes(bitmap.buffer), "raw", raw_mode)


def render_page(document, index: int, dpi: int, max_pixels: int) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Render one page at ``dpi``, shrinking it if it would exceed ``max_pixels``."""
    page = document[index]
    width_pt, height_pt = _page_size(page)

    scale = dpi / 72.0
    estimated_pixels = (width_pt * scale) * (height_pt * scale)
    dpi_used = int(round(dpi))
    if estimated_pixels > max_pixels > 0:
        scale *= math.sqrt(max_pixels / estimated_pixels)
        dpi_used = int(round(72.0 * scale))

    bitmap = page.render(scale=scale)
    try:
        image = _bitmap_to_pil(bitmap).convert("L")
    finally:
        close = getattr(bitmap, "close", None)
        if callable(close):
            close()

    gray = np.asarray(image)
    rotation = 0
    get_rotation = getattr(page, "get_rotation", None)
    if callable(get_rotation):
        try:
            rotation = int(get_rotation())
        except Exception:  # pragma: no cover - defensive
            rotation = 0

    meta: Dict[str, Any] = {
        "dpi": dpi_used,
        "width_px": int(gray.shape[1]),
        "height_px": int(gray.shape[0]),
        "width_pt": float(width_pt),
        "height_pt": float(height_pt),
        "rotation": rotation,
    }
    return gray, meta


def load_image(path: str, max_pixels: int) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Load a standalone image as grayscale, honouring EXIF orientation."""
    with Image.open(path) as handle:
        image = ImageOps.exif_transpose(handle)
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")
        width, height = image.size
        resized = False
        if max_pixels > 0 and width * height > max_pixels:
            factor = math.sqrt(max_pixels / float(width * height))
            width = max(1, int(width * factor))
            height = max(1, int(height * factor))
            image = image.resize((width, height), Image.LANCZOS)
            resized = True
        gray = np.asarray(image.convert("L"))

    meta: Dict[str, Any] = {
        "dpi": None,
        "width_px": int(gray.shape[1]),
        "height_px": int(gray.shape[0]),
        "width_pt": None,
        "height_pt": None,
        "rotation": 0,
        "resized_for_pixel_budget": resized,
        "filename_suffix": Path(path).suffix.lower(),
    }
    return gray, meta


def image_page_size(gray: np.ndarray) -> Tuple[float, float]:
    return float(gray.shape[1]), float(gray.shape[0])
