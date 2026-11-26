"""CPU-only image cleanup before OCR.

Tesseract 5 does its own binarisation and generally does better on grayscale
input, so the default pipeline only fixes the things Tesseract cannot fix:
size, contrast and skew. Binarisation stays available but off by default.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np

from medical_report.config import Settings
from medical_report.errors import InvalidRequest

_SKEW_TARGET_WIDTH = 1200
_SKEW_MIN_FOREGROUND = 100


def cap_pixels(gray: np.ndarray, max_pixels: int) -> Tuple[np.ndarray, float]:
    height, width = gray.shape[:2]
    if max_pixels <= 0 or width * height <= max_pixels:
        return gray, 1.0
    factor = math.sqrt(max_pixels / float(width * height))
    target = (max(1, int(width * factor)), max(1, int(height * factor)))
    return cv2.resize(gray, target, interpolation=cv2.INTER_AREA), factor


def maybe_upscale(gray: np.ndarray, min_width: int, target_width: int) -> Tuple[np.ndarray, float]:
    height, width = gray.shape[:2]
    if width >= min_width or width == 0:
        return gray, 1.0
    wanted = min(target_width, int(width * 2.5))
    if wanted <= width:
        return gray, 1.0
    factor = wanted / float(width)
    resized = cv2.resize(gray, (wanted, max(1, int(height * factor))), interpolation=cv2.INTER_CUBIC)
    return resized, factor


def apply_clahe(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(gray)


def binarize(gray: np.ndarray, method: str) -> np.ndarray:
    method = (method or "none").lower()
    if method == "otsu":
        _, output = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        return output
    if method == "adaptive":
        return cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
        )
    raise InvalidRequest(
        "Unknown binarisation method.",
        details={"method": method, "allowed": ["none", "otsu", "adaptive"]},
    )


def _text_mask(gray: np.ndarray) -> Optional[np.ndarray]:
    if gray.size == 0:
        return None
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    return mask


def projection_score(gray: np.ndarray) -> float:
    """Variance of horizontal ink profile: peaks when text rows are level."""
    mask = _text_mask(gray)
    if mask is None:
        return 0.0
    row_sums = mask.sum(axis=1, dtype=np.float64)
    if row_sums.size == 0:
        return 0.0
    return float(np.var(row_sums))


def warp(image: np.ndarray, angle: float) -> np.ndarray:
    """Rotate in place (same canvas) so pixel<->point mapping stays exact."""
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2.0, height / 2.0), angle, 1.0)
    border = 255 if image.ndim == 2 else (255, 255, 255)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=border,
    )


def _downscale_for_skew(gray: np.ndarray) -> np.ndarray:
    height, width = gray.shape[:2]
    if width <= _SKEW_TARGET_WIDTH:
        return gray
    factor = _SKEW_TARGET_WIDTH / float(width)
    return cv2.resize(gray, (_SKEW_TARGET_WIDTH, max(1, int(height * factor))), interpolation=cv2.INTER_AREA)


def _coarse_angle(mask: np.ndarray, limit: float) -> float:
    coords = cv2.findNonZero(mask)
    if coords is None or len(coords) < _SKEW_MIN_FOREGROUND:
        return 0.0
    angle = float(cv2.minAreaRect(coords)[-1])
    if angle > 45.0:
        angle -= 90.0
    elif angle < -45.0:
        angle += 90.0
    return angle if abs(angle) <= limit else 0.0


def estimate_skew(gray: np.ndarray, max_angle: float = 12.0) -> float:
    """Return the rotation (degrees, cv2 sign convention) that levels the text.

    The sign is decided empirically: candidate angles are applied and the one
    with the strongest horizontal ink profile wins, so no sign bookkeeping.
    """
    if gray.size == 0:
        return 0.0
    small = _downscale_for_skew(gray)
    base_mask = _text_mask(small)
    if base_mask is None:
        return 0.0

    best_angle = 0.0
    best_score = projection_score(small)

    coarse = _coarse_angle(base_mask, max_angle)
    candidates = [0.0]
    offset = -3.0
    while offset <= 3.0001:
        candidate = coarse + offset
        if abs(candidate) <= max_angle:
            candidates.append(round(candidate, 2))
        offset += 1.0

    for angle in candidates:
        if abs(angle) < 1e-9:
            continue
        score = projection_score(warp(small, angle))
        if score > best_score:
            best_angle, best_score = angle, score

    step = -1.0
    while step <= 1.0001:
        candidate = best_angle + step
        if abs(candidate) <= max_angle:
            score = projection_score(warp(small, candidate))
            if score > best_score:
                best_angle, best_score = candidate, score
        step += 0.25

    return round(best_angle, 2)


def prepare_for_ocr(gray: np.ndarray, settings: Settings) -> Tuple[np.ndarray, Dict[str, Any]]:
    """Clean an image and report exactly what was done to it."""
    steps = []
    image, pixel_factor = cap_pixels(gray, settings.max_pixels)
    if pixel_factor < 1.0:
        steps.append(f"downscaled x{pixel_factor:.2f} to respect the pixel budget")

    image, upscale_factor = maybe_upscale(image, settings.upscale_min_width, settings.upscale_target_width)
    if upscale_factor > 1.0:
        steps.append(f"upscaled x{upscale_factor:.2f} for small-image OCR")

    contrast = float(image.std()) if image.size else 0.0
    if contrast < 28.0:
        image = apply_clahe(image)
        steps.append("applied CLAHE (low-contrast scan)")

    angle = 0.0
    if settings.deskew and image.size:
        angle = estimate_skew(image, settings.max_skew_degrees)
        if abs(angle) >= 0.3:
            image = warp(image, angle)
            steps.append(f"deskewed by {angle:+.2f} deg")

    if settings.binarize and settings.binarize != "none":
        image = binarize(image, settings.binarize)
        steps.append(f"binarised ({settings.binarize})")

    meta: Dict[str, Any] = {
        "steps": steps,
        "skew_degrees": angle,
        "contrast_std": round(contrast, 1),
        "width_px": int(image.shape[1]),
        "height_px": int(image.shape[0]),
        "binarize": settings.binarize,
    }
    return image, meta
