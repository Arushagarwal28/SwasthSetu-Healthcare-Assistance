"""Pluggable OCR engines.

Only Tesseract is implemented. ``OcrEngine`` is the seam a heavier engine
(PaddleOCR with Devanagari models, or a hosted vision API) would plug into
later without touching the extraction pipeline.
"""

from __future__ import annotations

import os
import shutil
import statistics
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import pytesseract
from PIL import Image

from medical_report.config import Settings
from medical_report.errors import InvalidLanguage, OcrFailed, OcrUnavailable


@dataclass(slots=True)
class OcrWord:
    text: str
    confidence: float
    left: int
    top: int
    width: int
    height: int
    block: int
    par: int
    line: int
    index: int


@dataclass(slots=True)
class OcrOutput:
    words: List[OcrWord]
    text: str
    mean_confidence: float
    low_confidence_ratio: float
    languages: List[str]
    psm: int
    oem: int
    duration_ms: float
    warnings: List[str] = field(default_factory=list)


class OcrEngine(ABC):
    """Minimal contract every OCR backend must satisfy."""

    name: str = "unknown"

    @abstractmethod
    def is_available(self) -> bool: ...

    @abstractmethod
    def version(self) -> Optional[str]: ...

    @abstractmethod
    def list_languages(self) -> List[str]: ...

    @abstractmethod
    def recognize(
        self,
        image: np.ndarray,
        *,
        languages: Sequence[str],
        psm: int,
        oem: int,
        timeout: int,
        min_confidence: float,
        char_whitelist: Optional[str] = None,
    ) -> OcrOutput: ...

    def detect_script(self, image: np.ndarray, timeout: int = 20) -> Tuple[Optional[str], Optional[float]]:
        """Return ``(script, confidence)`` when the backend supports OSD."""
        return None, None

    def describe(self) -> Dict[str, Any]:
        available = self.is_available()
        return {
            "name": self.name,
            "available": available,
            "version": self.version() if available else None,
            "languages": self.list_languages() if available else [],
        }


class TesseractOcrEngine(OcrEngine):
    name = "tesseract"

    def __init__(self, cmd: Optional[str], tessdata_prefix: Optional[str] = None) -> None:
        self._cmd = cmd
        self._version: Optional[str] = None
        self._languages: Optional[List[str]] = None
        if tessdata_prefix:
            os.environ.setdefault("TESSDATA_PREFIX", tessdata_prefix)
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd

    def is_available(self) -> bool:
        if not self._cmd:
            return False
        if not os.path.exists(self._cmd) and shutil.which(self._cmd) is None:
            return False
        try:
            return bool(self.version())
        except Exception:  # pragma: no cover - defensive
            return False

    def version(self) -> Optional[str]:
        if self._version is None:
            try:
                self._version = str(pytesseract.get_tesseract_version())
            except Exception as exc:
                raise OcrUnavailable(
                    "The OCR engine (Tesseract) is not available on this server.",
                    details={"reason": type(exc).__name__},
                ) from exc
        return self._version

    def list_languages(self) -> List[str]:
        if self._languages is None:
            try:
                self._languages = sorted(pytesseract.get_languages(config=""))
            except Exception:  # pragma: no cover - defensive
                self._languages = []
        return list(self._languages)

    @staticmethod
    def _to_pil(image: np.ndarray) -> Image.Image:
        array = image if image.ndim == 2 else image[:, :, 0]
        return Image.fromarray(array)

    def recognize(
        self,
        image: np.ndarray,
        *,
        languages: Sequence[str],
        psm: int,
        oem: int,
        timeout: int,
        min_confidence: float,
        char_whitelist: Optional[str] = None,
    ) -> OcrOutput:
        started = time.perf_counter()
        language = "+".join(languages) if languages else "eng"
        config = f"--oem {oem} --psm {psm} -c preserve_interword_spaces=1"
        if char_whitelist:
            config += f" -c tessedit_char_whitelist={char_whitelist}"

        try:
            data = pytesseract.image_to_data(
                self._to_pil(image),
                lang=language,
                config=config,
                output_type=pytesseract.Output.DICT,
                timeout=timeout,
            )
        except pytesseract.TesseractNotFoundError as exc:
            raise OcrUnavailable("The OCR engine (Tesseract) is not available on this server.") from exc
        except pytesseract.TesseractError as exc:
            message = str(exc)
            if "Failed loading language" in message or "is not a valid language" in message:
                raise InvalidLanguage(
                    "One of the requested OCR languages is not installed on this server.",
                    details={"requested": list(languages)},
                ) from exc
            raise OcrFailed(
                "OCR failed while reading this page.",
                details={"reason": type(exc).__name__},
            ) from exc
        except RuntimeError as exc:  # pytesseract raises RuntimeError on timeout
            raise OcrFailed(
                "OCR timed out while reading this page.",
                details={"reason": "timeout", "timeout_seconds": timeout},
            ) from exc

        words: List[OcrWord] = []
        confidences: List[float] = []
        counters = data.get("level", [])
        for position in range(len(data.get("text", []))):
            text = (data["text"][position] or "").strip()
            if not text:
                continue
            try:
                confidence = float(data["conf"][position])
            except (TypeError, ValueError):
                continue
            if confidence < 0:
                continue
            if counters and counters[position] not in (5,):
                # level 5 == word; other levels never carry confidence
                continue
            words.append(
                OcrWord(
                    text=text,
                    confidence=confidence,
                    left=int(data["left"][position]),
                    top=int(data["top"][position]),
                    width=int(data["width"][position]),
                    height=int(data["height"][position]),
                    block=int(data["block_num"][position]),
                    par=int(data["par_num"][position]),
                    line=int(data["line_num"][position]),
                    index=int(data["word_num"][position]),
                )
            )
            confidences.append(confidence)

        lines: Dict[Tuple[int, int, int], List[str]] = {}
        for word in words:
            lines.setdefault((word.block, word.par, word.line), []).append(word.text)
        text = "\n".join(" ".join(parts) for parts in lines.values())

        mean_confidence = round(statistics.fmean(confidences), 2) if confidences else 0.0
        low_confidence_ratio = (
            sum(1 for value in confidences if value < min_confidence) / len(confidences) if confidences else 0.0
        )

        return OcrOutput(
            words=words,
            text=text,
            mean_confidence=mean_confidence,
            low_confidence_ratio=low_confidence_ratio,
            languages=list(languages),
            psm=psm,
            oem=oem,
            duration_ms=round((time.perf_counter() - started) * 1000.0, 1),
        )

    def detect_script(self, image: np.ndarray, timeout: int = 20) -> Tuple[Optional[str], Optional[float]]:
        try:
            osd = pytesseract.image_to_osd(
                self._to_pil(image),
                output_type=pytesseract.Output.DICT,
                timeout=timeout,
            )
        except Exception:
            # OSD needs a fair amount of text; failing it is normal.
            return None, None
        script = osd.get("script")
        try:
            confidence = float(osd.get("script_conf", 0.0) or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0
        return (str(script) if script else None), confidence


@lru_cache(maxsize=4)
def _build_engine(cmd: Optional[str], tessdata: Optional[str]) -> TesseractOcrEngine:
    return TesseractOcrEngine(cmd, tessdata)


def get_engine(settings: Settings) -> OcrEngine:
    return _build_engine(settings.tesseract_cmd, settings.tessdata_prefix)


def reset_engines() -> None:
    _build_engine.cache_clear()


def resolve_languages(
    image: np.ndarray,
    engine: OcrEngine,
    settings: Settings,
    override: Optional[Sequence[str]] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Pick OCR languages: explicit request, then OSD script detection, then default."""
    available = set(engine.list_languages())

    if override:
        requested = [code for code in override if code]
        missing = [code for code in requested if code not in available]
        if missing:
            raise InvalidLanguage(
                "One of the requested OCR languages is not installed on this server.",
                details={"requested": requested, "missing": missing, "available": sorted(available)},
            )
        return requested, {"source": "request", "script": None, "script_confidence": None}

    default = list(settings.default_langs)
    if not settings.auto_detect_language or "osd" not in available:
        return default, {"source": "default", "script": None, "script_confidence": None}

    script, confidence = engine.detect_script(image)
    if script and "Devanagari" in script and all(code in available for code in settings.hindi_langs):
        return list(settings.hindi_langs), {"source": "osd", "script": script, "script_confidence": confidence}
    return default, {"source": "osd" if script else "default", "script": script, "script_confidence": confidence}
