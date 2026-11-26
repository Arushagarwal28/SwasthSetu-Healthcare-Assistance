"""Reconstruct lines, cells and tables from positioned words.

Works identically for native PDF words (points) and OCR words (pixels scaled
to points), which keeps downstream parsing source-agnostic.
"""

from __future__ import annotations

import statistics
from typing import List, Optional, Sequence

from medical_report.pipeline.types import Line, Table, Word

#: A gap wider than ``max(height * CELL_GAP, min(gap * GAP_RATIO, height * 2))``
#: starts a new cell. Anchoring the upper bound to the text height keeps a
#: table row (where *every* gap is wide) from being treated as one cell.
CELL_GAP = 1.2
GAP_RATIO = 2.0


def _split_cells(words: Sequence[Word]) -> List[List[Word]]:
    ordered = sorted(words, key=lambda word: word.x0)
    if len(ordered) <= 1:
        return [list(ordered)]

    gaps = [ordered[index + 1].x0 - ordered[index].x1 for index in range(len(ordered) - 1)]
    heights = [max(word.height, 0.1) for word in ordered]
    median_height = statistics.median(heights)
    positive_gaps = [gap for gap in gaps if gap > 0]
    median_gap = statistics.median(positive_gaps) if positive_gaps else median_height * 0.3
    threshold = max(median_height * CELL_GAP, min(median_gap * GAP_RATIO, median_height * 2.0))

    cells: List[List[Word]] = [[ordered[0]]]
    for gap, word in zip(gaps, ordered[1:]):
        if gap > threshold:
            cells.append([word])
        else:
            cells[-1].append(word)
    return cells


def words_to_lines(words: Sequence[Word], y_tolerance: Optional[float] = None) -> List[Line]:
    """Group words into visual lines, then split each line into cells."""
    if not words:
        return []

    ordered = sorted(words, key=lambda word: (round(word.top, 1), word.x0))
    heights = [max(word.height, 0.1) for word in ordered]
    tolerance = y_tolerance if y_tolerance is not None else max(statistics.median(heights) * 0.6, 2.0)

    groups: List[List[Word]] = [[ordered[0]]]
    current_center = ordered[0].center_y
    for word in ordered[1:]:
        if abs(word.center_y - current_center) <= tolerance:
            groups[-1].append(word)
            current_center = statistics.fmean(item.center_y for item in groups[-1])
        else:
            groups.append([word])
            current_center = word.center_y

    lines: List[Line] = []
    for group in groups:
        cells = _split_cells(group)
        flat = [word for cell in cells for word in cell]
        confidences = [word.confidence for word in flat if word.confidence is not None]
        lines.append(
            Line(
                text=" ".join(word.text for word in flat),
                cells=cells,
                x0=min(word.x0 for word in flat),
                x1=max(word.x1 for word in flat),
                top=min(word.top for word in flat),
                bottom=max(word.bottom for word in flat),
                confidence=round(statistics.fmean(confidences), 1) if confidences else None,
            )
        )
    return lines


def _mean_confidence(rows: Sequence[Sequence[Word]]) -> Optional[float]:
    values = [word.confidence for row in rows for word in row if word.confidence is not None]
    if not values:
        return None
    return round(statistics.fmean(values), 1)


def infer_tables(
    lines: Sequence[Line],
    *,
    min_rows: int = 3,
    min_columns: int = 3,
    x_tolerance: float = 20.0,
) -> List[Table]:
    """Detect table-like blocks by clustering cell start positions into columns."""
    candidates = [line for line in lines if len(line.cells) >= min_columns]
    if len(candidates) < min_rows:
        return []

    starts = sorted({round(cell[0].x0, 1) for line in candidates for cell in line.cells})
    bands: List[List[float]] = []
    for start in starts:
        if bands and start - bands[-1][-1] <= x_tolerance:
            bands[-1].append(start)
        else:
            bands.append([start])
    positions = [statistics.fmean(band) for band in bands]
    if len(positions) < min_columns:
        return []

    blocks: List[List[Line]] = [[candidates[0]]]
    for previous, current in zip(candidates, candidates[1:]):
        gap = current.top - previous.bottom
        if gap > max(previous.height, current.height, 4.0) * 1.2:
            blocks.append([current])
        else:
            blocks[-1].append(current)

    tables: List[Table] = []
    for block in blocks:
        if len(block) < min_rows:
            continue
        rows: List[List[str]] = []
        row_words: List[List[Word]] = []
        for line in block:
            row = [""] * len(positions)
            words_in_row: List[Word] = []
            for cell in line.cells:
                anchor = cell[0].x0
                index = min(range(len(positions)), key=lambda position: abs(positions[position] - anchor))
                text = " ".join(word.text for word in cell).strip()
                row[index] = f"{row[index]} {text}".strip()
                words_in_row.extend(cell)
            if sum(1 for value in row if value) >= min_columns:
                rows.append(row)
                row_words.append(words_in_row)
        if len(rows) < min_rows:
            continue
        tables.append(
            Table(
                rows=rows,
                columns=len(positions),
                source="ocr_heuristic",
                bbox={
                    "x0": min(line.x0 for line in block),
                    "top": min(line.top for line in block),
                    "x1": max(line.x1 for line in block),
                    "bottom": max(line.bottom for line in block),
                },
                confidence=_mean_confidence(row_words),
            )
        )
    return tables
