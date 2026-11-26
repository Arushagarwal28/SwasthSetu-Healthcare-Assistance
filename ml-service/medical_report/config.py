"""Environment-driven configuration for the medical report OCR service.

Every knob is read from an environment variable prefixed with ``MEDICAL_OCR_``
so the service can be tuned per deployment without code changes. Defaults are
chosen for a CPU-only laptop, which is what SwasthSetu targets.
"""

from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

from medical_report import __version__

#: Places Tesseract is commonly installed. Checked only if it is not on PATH.
TESSERACT_CANDIDATES: Tuple[str, ...] = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    "/usr/bin/tesseract",
    "/usr/local/bin/tesseract",
    "/opt/homebrew/bin/tesseract",
)

_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}


def _load_local_env() -> None:
    """Load ``ml-service/.env`` for local runs, without overriding real env vars.

    Only ``MEDICAL_`` keys are read, so a project-wide ``.env`` cannot leak a
    database password into this service. The file is optional.
    """
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.is_file():
        return
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key.startswith("MEDICAL_"):
            continue
        os.environ.setdefault(key, value.strip().strip('"').strip("'"))


def _env_str(name: str, default: str) -> str:
    raw = os.environ.get(name)
    return raw.strip() if raw and raw.strip() else default


def _env_optional(name: str) -> Optional[str]:
    raw = os.environ.get(name)
    return raw.strip() if raw and raw.strip() else None


def _env_int(name: str, default: int, *, minimum: Optional[int] = None, maximum: Optional[int] = None) -> int:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = int(float(raw.strip()))
    except ValueError:
        return default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def _env_float(name: str, default: float, *, minimum: Optional[float] = None, maximum: Optional[float] = None) -> float:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw.strip())
    except ValueError:
        return default
    if minimum is not None:
        value = max(minimum, value)
    if maximum is not None:
        value = min(maximum, value)
    return value


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    value = raw.strip().lower()
    if value in _TRUE:
        return True
    if value in _FALSE:
        return False
    return default


def _env_langs(name: str, default: Tuple[str, ...]) -> Tuple[str, ...]:
    raw = os.environ.get(name)
    if not raw or not raw.strip():
        return default
    parts = tuple(part.strip() for part in raw.split(",") if part.strip())
    return parts or default


def resolve_tesseract_cmd(explicit: Optional[str] = None) -> Optional[str]:
    """Locate the Tesseract binary without requiring it to be on PATH."""
    if explicit:
        return explicit
    found = shutil.which("tesseract")
    if found:
        return found
    for candidate in TESSERACT_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return None


@dataclass(frozen=True)
class Settings:
    """Immutable runtime configuration."""

    service_name: str = "swasthsetu-medical-report-ocr"
    host: str = "127.0.0.1"
    port: int = 8001

    # --- OCR engine -------------------------------------------------------
    tesseract_cmd: Optional[str] = None
    tessdata_prefix: Optional[str] = None
    default_langs: Tuple[str, ...] = ("eng",)
    hindi_langs: Tuple[str, ...] = ("hin", "eng")
    auto_detect_language: bool = True
    ocr_dpi: int = 300
    min_dpi: int = 150
    max_dpi: int = 600
    psm: int = 3
    oem: int = 3
    ocr_timeout_seconds: int = 180

    # --- Input limits -----------------------------------------------------
    max_file_bytes: int = 20 * 1024 * 1024
    max_pages: int = 30
    max_pixels: int = 40_000_000

    # --- Digital-text detection ------------------------------------------
    min_digital_words: int = 8
    min_digital_chars: int = 40
    image_dominance_ratio: float = 0.8

    # --- Quality reporting ------------------------------------------------
    min_confidence: float = 60.0
    low_confidence_page_threshold: float = 55.0

    # --- Pre-processing ---------------------------------------------------
    deskew: bool = True
    max_skew_degrees: float = 12.0
    binarize: str = "none"  # none | otsu | adaptive
    upscale_min_width: int = 1000
    upscale_target_width: int = 1600

    # --- Internal access control -------------------------------------------
    #: Shared secret the Node backend must present as ``X-Internal-Token``.
    #: When unset the guard is disabled (loopback-only local development), so
    #: set ``MEDICAL_REPORT_SERVICE_TOKEN`` outside a trusted machine.
    service_token: Optional[str] = None

    # --- Privacy ----------------------------------------------------------
    temp_dir: Optional[str] = None
    temp_prefix: str = "swasthsetu-report-"
    stale_temp_minutes: int = 60

    @property
    def version(self) -> str:
        return __version__

    @property
    def max_file_mb(self) -> float:
        return round(self.max_file_bytes / (1024 * 1024), 1)


def _build_settings() -> Settings:
    _load_local_env()
    tesseract = resolve_tesseract_cmd(_env_optional("MEDICAL_OCR_TESSERACT_CMD"))
    return Settings(
        host=_env_str("MEDICAL_OCR_HOST", "127.0.0.1"),
        port=_env_int("MEDICAL_OCR_PORT", 8001, minimum=1, maximum=65535),
        tesseract_cmd=tesseract,
        tessdata_prefix=_env_optional("MEDICAL_OCR_TESSDATA_PREFIX"),
        default_langs=_env_langs("MEDICAL_OCR_DEFAULT_LANGS", ("eng",)),
        hindi_langs=_env_langs("MEDICAL_OCR_HINDI_LANGS", ("hin", "eng")),
        auto_detect_language=_env_bool("MEDICAL_OCR_AUTO_LANG", True),
        ocr_dpi=_env_int("MEDICAL_OCR_DPI", 300, minimum=100, maximum=600),
        min_dpi=_env_int("MEDICAL_OCR_MIN_DPI", 150, minimum=50, maximum=600),
        max_dpi=_env_int("MEDICAL_OCR_MAX_DPI", 600, minimum=100, maximum=900),
        psm=_env_int("MEDICAL_OCR_PSM", 3, minimum=0, maximum=13),
        oem=_env_int("MEDICAL_OCR_OEM", 3, minimum=0, maximum=3),
        ocr_timeout_seconds=_env_int("MEDICAL_OCR_TIMEOUT_SECONDS", 180, minimum=5, maximum=900),
        max_file_bytes=_env_int("MEDICAL_OCR_MAX_FILE_MB", 20, minimum=1, maximum=200) * 1024 * 1024,
        max_pages=_env_int("MEDICAL_OCR_MAX_PAGES", 30, minimum=1, maximum=200),
        max_pixels=_env_int("MEDICAL_OCR_MAX_PIXELS", 40_000_000, minimum=1_000_000),
        min_digital_words=_env_int("MEDICAL_OCR_MIN_DIGITAL_WORDS", 8, minimum=1),
        min_digital_chars=_env_int("MEDICAL_OCR_MIN_DIGITAL_CHARS", 40, minimum=1),
        image_dominance_ratio=_env_float("MEDICAL_OCR_IMAGE_DOMINANCE", 0.8, minimum=0.1, maximum=1.0),
        min_confidence=_env_float("MEDICAL_OCR_MIN_CONFIDENCE", 60.0, minimum=0.0, maximum=100.0),
        low_confidence_page_threshold=_env_float(
            "MEDICAL_OCR_LOW_CONFIDENCE_PAGE", 55.0, minimum=0.0, maximum=100.0
        ),
        deskew=_env_bool("MEDICAL_OCR_DESKEW", True),
        max_skew_degrees=_env_float("MEDICAL_OCR_MAX_SKEW", 12.0, minimum=0.0, maximum=45.0),
        binarize=_env_str("MEDICAL_OCR_BINARIZE", "none").lower(),
        upscale_min_width=_env_int("MEDICAL_OCR_UPSCALE_MIN_WIDTH", 1000, minimum=200),
        upscale_target_width=_env_int("MEDICAL_OCR_UPSCALE_TARGET_WIDTH", 1600, minimum=400),
        service_token=_env_optional("MEDICAL_REPORT_SERVICE_TOKEN"),
        temp_dir=_env_optional("MEDICAL_OCR_TEMP_DIR"),
        temp_prefix=_env_str("MEDICAL_OCR_TEMP_PREFIX", "swasthsetu-report-"),
        stale_temp_minutes=_env_int("MEDICAL_OCR_STALE_TEMP_MINUTES", 60, minimum=0),
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide settings, built once from the environment."""
    return _build_settings()


def reload_settings() -> Settings:
    """Re-read the environment (used by tests and local scripts)."""
    get_settings.cache_clear()
    return get_settings()
