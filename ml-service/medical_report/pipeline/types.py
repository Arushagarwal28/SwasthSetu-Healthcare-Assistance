"""Plain data structures produced by the extraction pipeline.

Coordinates are in PDF points (``units == "pt"``) for PDFs and pixels
(``units == "px"``) for standalone images. The origin is always top-left so
layout code does not need to know which source a page came from.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


def _round(value: Optional[float], digits: int = 2) -> Optional[float]:
    return None if value is None else round(float(value), digits)


@dataclass(slots=True)
class Word:
    text: str
    x0: float
    x1: float
    top: float
    bottom: float
    confidence: Optional[float] = None  # None => native PDF text, not OCR

    @property
    def width(self) -> float:
        return max(self.x1 - self.x0, 0.0)

    @property
    def height(self) -> float:
        return max(self.bottom - self.top, 0.0)

    @property
    def center_y(self) -> float:
        return (self.top + self.bottom) / 2.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "x0": _round(self.x0),
            "x1": _round(self.x1),
            "top": _round(self.top),
            "bottom": _round(self.bottom),
            "confidence": _round(self.confidence, 1),
        }


@dataclass(slots=True)
class Line:
    text: str
    cells: List[List[Word]]
    x0: float
    x1: float
    top: float
    bottom: float
    confidence: Optional[float] = None

    @property
    def height(self) -> float:
        return max(self.bottom - self.top, 0.0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "cells": [[" ".join(word.text for word in cell)] for cell in self.cells],
            "bbox": {"x0": _round(self.x0), "x1": _round(self.x1), "top": _round(self.top), "bottom": _round(self.bottom)},
            "confidence": _round(self.confidence, 1),
        }


@dataclass(slots=True)
class Table:
    rows: List[List[str]]
    columns: int
    source: str  # "pdf_text" | "ocr_heuristic"
    bbox: Dict[str, float]
    confidence: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rows": self.rows,
            "columns": self.columns,
            "source": self.source,
            "bbox": {key: _round(value) for key, value in self.bbox.items()},
            "confidence": _round(self.confidence, 1),
        }


@dataclass(slots=True)
class PageResult:
    index: int
    width: float
    height: float
    units: str
    source: str  # "pdf_text" | "ocr"
    languages: List[str]
    text: str
    lines: List[Line]
    tables: List[Table]
    word_count: int
    mean_confidence: Optional[float] = None
    low_confidence_word_ratio: Optional[float] = None
    rotation: int = 0
    dpi: Optional[int] = None
    script: Optional[str] = None
    script_confidence: Optional[float] = None
    preprocessing: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "width": _round(self.width),
            "height": _round(self.height),
            "units": self.units,
            "source": self.source,
            "languages": self.languages,
            "script": self.script,
            "script_confidence": _round(self.script_confidence, 1),
            "rotation": self.rotation,
            "dpi": self.dpi,
            "text": self.text,
            "line_count": len(self.lines),
            "word_count": self.word_count,
            "mean_confidence": _round(self.mean_confidence, 1),
            "low_confidence_word_ratio": _round(self.low_confidence_word_ratio, 3),
            "preprocessing": self.preprocessing,
            "lines": [line.to_dict() for line in self.lines],
            "tables": [table.to_dict() for table in self.tables],
            "warnings": self.warnings,
        }


@dataclass(slots=True)
class DocumentResult:
    kind: str  # "pdf" | "image"
    units: str
    engine: Dict[str, Any]
    pages: List[PageResult]
    warnings: List[str]
    stats: Dict[str, Any]
    document_id: Optional[str] = None

    @property
    def text(self) -> str:
        return "\n\n".join(page.text for page in self.pages if page.text)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": True,
            "document_id": self.document_id,
            "kind": self.kind,
            "units": self.units,
            "engine": self.engine,
            "stats": self.stats,
            "warnings": self.warnings,
            "pages": [page.to_dict() for page in self.pages],
            "text": self.text,
        }
