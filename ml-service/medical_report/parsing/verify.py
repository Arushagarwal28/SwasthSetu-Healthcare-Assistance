"""Cross-verify numbers with the English OCR model.

Hindi OCR (``hin+eng``) reads Devanagari reliably but can drop or alter digits
(``13.4`` -> ``3.4`` in Phase 1 testing). For every numeric field on an OCR page
we therefore re-read just that value box with ``eng`` and compare. A
disagreement never changes the value: it marks the result ``NEEDS_REVIEW`` and
records both readings.
"""

from __future__ import annotations

import re
from typing import Dict, Optional, Tuple

import cv2
import numpy as np

from medical_report.config import Settings
from medical_report.errors import ExtractionError
from medical_report.parsing.types import Verification
from medical_report.pipeline import preprocess, render
from medical_report.pipeline.ocr_engine import OcrEngine, get_engine
from medical_report.pipeline.types import PageResult

_NUMBER_WHITELIST = "0123456789.,<>-"
#: Generous context decides whether a decimal point survives re-reading.
_PADDING_RATIO_Y = 0.6
_PADDING_RATIO_X = 0.6
_MIN_CROP_HEIGHT = 60


def normalize_number_text(text: Optional[str]) -> str:
    if not text:
        return ""
    return "".join(char for char in text if char.isdigit() or char in ".,<>-+/ ").strip()


def _as_float(text: str):
    candidate = text.replace(" ", "").replace(",", ".")
    try:
        return float(candidate)
    except ValueError:
        return None


def same_number(primary: Optional[str], secondary: Optional[str]) -> bool:
    left = normalize_number_text(primary)
    right = normalize_number_text(secondary)
    if not left or not right:
        return False
    if left == right:
        return True
    left_value, right_value = _as_float(left), _as_float(right)
    if left_value is not None and right_value is not None:
        return abs(left_value - right_value) < 1e-9
    return False


class NumericVerifier:
    """Re-OCR numeric value boxes on OCR pages with the English model."""

    def __init__(self, path: str, kind: str, settings: Settings, engine: Optional[OcrEngine] = None):
        self._path = str(path)
        self._kind = kind
        self._settings = settings
        self._engine = engine or get_engine(settings)
        self._document = None
        self._cached_page = None
        self._cached_image: Optional[np.ndarray] = None

    # -- page rendering ----------------------------------------------------
    def _document_handle(self):
        if self._document is None and self._kind == "pdf":
            self._document = render.open_document(self._path)
        return self._document

    def _image_for(self, page: PageResult) -> np.ndarray:
        if self._cached_page is page and self._cached_image is not None:
            return self._cached_image
        if self._kind == "pdf":
            gray, _ = render.render_page(
                self._document_handle(), page.index, self._settings.ocr_dpi, self._settings.max_pixels
            )
        else:
            gray, _ = render.load_image(self._path, self._settings.max_pixels)
        prepared, _ = preprocess.prepare_for_ocr(gray, self._settings)
        self._cached_page = page
        self._cached_image = prepared
        return prepared

    # -- cropping ----------------------------------------------------------
    @staticmethod
    def _crop(image: np.ndarray, page: PageResult, bbox: Dict[str, float]) -> Optional[np.ndarray]:
        if page.width <= 0 or page.height <= 0:
            return None
        height_px, width_px = image.shape[:2]
        scale_x = width_px / float(page.width)
        scale_y = height_px / float(page.height)

        x0 = int(bbox.get("x0", 0) * scale_x)
        x1 = int(bbox.get("x1", 0) * scale_x)
        top = int(bbox.get("top", 0) * scale_y)
        bottom = int(bbox.get("bottom", 0) * scale_y)

        pad_y = max(3, int((bottom - top) * _PADDING_RATIO_Y))
        pad_x = max(3, int((bottom - top) * _PADDING_RATIO_X))
        x0 = max(0, x0 - pad_x)
        top = max(0, top - pad_y)
        x1 = min(width_px, x1 + pad_x)
        bottom = min(height_px, bottom + pad_y)

        if x1 - x0 < 6 or bottom - top < 6:
            return None
        crop = image[top:bottom, x0:x1]
        # Small crops are unreliable; a 2x upscale reads digits far better.
        if crop.shape[0] < _MIN_CROP_HEIGHT:
            crop = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        return crop

    # -- verification ------------------------------------------------------
    def __call__(self, page: PageResult, bbox: Dict[str, float], primary_text: str) -> Verification:
        base = Verification(checked=True, primary_reading=primary_text, languages=("eng",))
        if not self._engine.is_available():
            base.agreement = "unavailable"
            return base

        image = self._image_for(page)
        crop = self._crop(image, page, bbox)
        if crop is None:
            base.agreement = "unavailable"
            return base

        try:
            output = self._engine.recognize(
                crop,
                languages=["eng"],
                psm=7,
                oem=3,
                timeout=20,
                min_confidence=0.0,
                char_whitelist=_NUMBER_WHITELIST,
            )
        except ExtractionError:
            base.agreement = "unavailable"
            return base

        tokens = re.findall(r"[<>]?\s*\d+(?:[.,]\d+)?", output.text or "")
        secondary = tokens[0].strip() if tokens else ""
        if not secondary:
            base.agreement = "unavailable"
            return base

        base.secondary_reading = secondary
        base.agreement = "match" if same_number(primary_text, secondary) else "mismatch"
        return base

    def close(self) -> None:
        if self._document is not None:
            try:
                self._document.close()
            finally:
                self._document = None
        self._cached_page = None
        self._cached_image = None

    def __enter__(self) -> "NumericVerifier":
        return self

    def __exit__(self, *_exc) -> None:
        self.close()
