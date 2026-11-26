"""Turn one positioned line into zero or more raw test rows.

Handles column layouts (name | value | unit | range | flag), inline layouts
(``Hemoglobin: 13.4 g/dL 12.0 - 15.0``) and two records on one line. Ambiguous
text is left in the row as-is; interpretation happens later.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

from medical_report.parsing import ranges, units
from medical_report.parsing.values import FULL_NUMBER, RANGE_LIKE, VALUE_TOKEN
from medical_report.pipeline.types import Line

FLAG_TOKENS: Dict[str, str] = {
    "h": "high",
    "high": "high",
    "↑": "high",
    "hh": "high",
    "l": "low",
    "low": "low",
    "↓": "low",
    "ll": "low",
    "a": "abnormal",
    "abn": "abnormal",
    "abnormal": "abnormal",
    "*": "abnormal",
    "critical": "abnormal",
    "n": "normal",
    "normal": "normal",
    "wnl": "normal",
}

_FLAG_TOKEN = re.compile(r"^[*↑↓]$|[A-Za-z]{1,9}$")

_STOP_NAMES = {"test", "result", "results", "unit", "units", "reference", "range", "flag", "method"}


@dataclass(slots=True)
class RawRow:
    key: Tuple[int, int, int]
    name_text: str
    value_text: Optional[str]
    unit_text: Optional[str]
    range_text: Optional[str]
    flag_text: Optional[str]
    page_index: int
    line_index: int
    bbox: Dict[str, float]
    value_bbox: Optional[Dict[str, float]]
    line_confidence: Optional[float]
    layout: str
    line_text: str


@dataclass(slots=True)
class InlineSplit:
    name: str
    value: str
    rest: str


def _cell_text(cell: Sequence[Any]) -> str:
    return " ".join(word.text for word in cell).strip()


def _words_for_value(words: Sequence[Any], value_text: str) -> List[Any]:
    """Narrow a cell down to the word(s) that actually hold the value."""
    target = value_text.replace(" ", "")
    if target:
        for word in words:
            if target in word.text.replace(" ", ""):
                return [word]
    numeric = [word for word in words if any(char.isdigit() for char in word.text)]
    return numeric or list(words)


def _bbox(words: Sequence[Any]) -> Dict[str, float]:
    return {
        "x0": min(word.x0 for word in words),
        "x1": max(word.x1 for word in words),
        "top": min(word.top for word in words),
        "bottom": max(word.bottom for word in words),
    }


def _strip_tail(text: str) -> str:
    return text.strip().strip(":-–—\t ")


def split_inline(text: str) -> Optional[InlineSplit]:
    """Split ``Name 13.4 rest`` when a readable name precedes the number."""
    for match in VALUE_TOKEN.finditer(text):
        prefix = _strip_tail(text[: match.start()])
        if not prefix or not any(char.isalpha() for char in prefix):
            continue
        if not re.match(r"^[A-Za-z\u0900-\u097F(]", prefix):
            continue
        if prefix.rstrip().endswith(("(", "-", "/", "+")):
            # e.g. "Vitamin D (25-OH)": the number belongs to the name.
            continue
        if units.normalize_unit(prefix).known:
            continue
        return InlineSplit(name=prefix, value=match.group(1).strip(), rest=_strip_tail(text[match.end() :]))
    return None


def _value_at_start(text: str) -> Optional[InlineSplit]:
    match = VALUE_TOKEN.match(text.strip())
    if not match:
        return None
    return InlineSplit(name="", value=match.group(1).strip(), rest=_strip_tail(text.strip()[match.end() :]))


def is_value_like(text: str) -> bool:
    candidate = text.strip().strip(",;")
    if not candidate:
        return False
    if FULL_NUMBER.match(candidate) or VALUE_TOKEN.match(candidate):
        return True
    if RANGE_LIKE.match(candidate):
        return True
    lowered = re.sub(r"\s+", " ", candidate.casefold())
    return lowered in {
        "negative", "neg", "nil", "absent", "not detected", "positive", "pos", "present",
        "detected", "reactive", "trace", "traces", "normal", "wnl", "clear", "turbid",
        "cloudy", "hazy", "pale yellow", "yellow", "few", "many", "plenty", "occasional",
        "rare", "numerous", "abundant", "seen", "+", "++", "+++", "++++",
    } or bool(re.fullmatch(r"\+{1,4}|\d\+", lowered))


def extract_flag(text: Optional[str]) -> Optional[Tuple[str, str]]:
    """Pull a laboratory flag token out of a cell."""
    if not text:
        return None
    tokens = text.strip().split()
    for index, token in enumerate(tokens):
        cleaned = token.strip("(),;")
        if not _FLAG_TOKEN.match(cleaned):
            continue
        raw = cleaned.casefold()
        if raw not in FLAG_TOKENS:
            continue
        remaining = " ".join(tokens[:index] + tokens[index + 1 :]).strip()
        # Keep the printed token; normalisation happens in the classifier.
        return cleaned, remaining
    return None


def decompose_tail(text: str) -> Optional[Tuple[Optional[str], Optional[str], Optional[str]]]:
    """Split a trailing cell into (unit, range, flag); ``None`` if unexplained."""
    remaining = text.strip()
    if not remaining:
        return None
    unit: Optional[str] = None
    range_text: Optional[str] = None
    flag: Optional[str] = None

    for _ in range(6):
        if not remaining:
            break
        if range_text is None:
            extraction = ranges.extract_range(remaining)
            if extraction is not None:
                range_text = extraction.range.text_raw
                remaining = extraction.remainder.strip()
                continue
        if flag is None:
            found = extract_flag(remaining)
            if found is not None:
                flag, remaining = found
                continue
        if unit is None:
            match = units.match_unit_prefix(remaining)
            if match is not None and match.raw:
                unit = match.raw
                remaining = match.remainder.strip()
                continue
        break

    if remaining:
        return None
    if unit is None and range_text is None and flag is None:
        return None
    return unit, range_text, flag


def _make_row(
    *,
    name_parts: Sequence[str],
    value_text: Optional[str],
    unit_text: Optional[str],
    range_text: Optional[str],
    flag_text: Optional[str],
    value_words: Optional[Sequence[Any]],
    line: Line,
    page_index: int,
    line_index: int,
    layout: str,
) -> RawRow:
    return RawRow(
        key=(page_index, line_index, 0),
        name_text=" ".join(part for part in name_parts if part).strip(),
        value_text=value_text,
        unit_text=unit_text,
        range_text=range_text,
        flag_text=flag_text,
        page_index=page_index,
        line_index=line_index,
        bbox={"x0": line.x0, "x1": line.x1, "top": line.top, "bottom": line.bottom},
        value_bbox=_bbox(value_words) if value_words else None,
        line_confidence=line.confidence,
        layout=layout,
        line_text=line.text,
    )


def _from_single_cell(cell_text: str, cell, line: Line, page_index: int, line_index: int) -> List[RawRow]:
    rows: List[RawRow] = []
    split = split_inline(cell_text)
    if split is None:
        return rows
    tail = decompose_tail(split.rest) if split.rest else None
    unit, range_text, flag = tail if tail else (None, None, None)
    if tail is None and split.rest:
        return rows
    rows.append(
        _make_row(
            name_parts=[split.name],
            value_text=split.value,
            unit_text=unit,
            range_text=range_text,
            flag_text=flag,
            value_words=_words_for_value(cell, split.value),
            line=line,
            page_index=page_index,
            line_index=line_index,
            layout="inline",
        )
    )
    return rows


def _from_columns(cells, line: Line, page_index: int, line_index: int) -> List[RawRow]:
    rows: List[RawRow] = []
    index = 0
    total = len(cells)

    while index < total:
        name_parts: List[str] = []
        value_text: Optional[str] = None
        value_words = None
        pending_tail: List[str] = []
        unit: Optional[str] = None
        range_text: Optional[str] = None
        flag: Optional[str] = None

        while index < total:
            text, words = cells[index]
            split = split_inline(text)
            if split is not None and split.name:
                name_parts.append(split.name)
                value_text = split.value
                value_words = _words_for_value(words, split.value)
                if split.rest:
                    pending_tail.append(split.rest)
                index += 1
                break
            if RANGE_LIKE.match(text):
                # "4-5 /hpf" is a range-style count reported as the result.
                value_text = text
                value_words = words
                index += 1
                break
            at_start = _value_at_start(text)
            if at_start is not None and at_start.name == "":
                value_text = at_start.value
                value_words = words
                if at_start.rest:
                    pending_tail.append(at_start.rest)
                index += 1
                break
            if is_value_like(text):
                value_text = text
                value_words = words
                index += 1
                break
            if text.casefold() in _STOP_NAMES:
                break
            if name_parts:
                parsed_tail = decompose_tail(text)
                if parsed_tail is not None:
                    part_unit, part_range, part_flag = parsed_tail
                    unit = unit or part_unit
                    range_text = range_text or part_range
                    flag = flag or part_flag
                    index += 1
                    continue
                if any(char.isdigit() for char in text):
                    # A garbled number belongs to the value column, not the name.
                    value_text = text
                    value_words = words
                    index += 1
                    break
            name_parts.append(text)
            index += 1

        if value_text is None:
            # A printed unit/range with no value: the result is genuinely absent.
            if name_parts and (unit is not None or range_text is not None or flag is not None):
                rows.append(
                    _make_row(
                        name_parts=name_parts,
                        value_text=None,
                        unit_text=unit,
                        range_text=range_text,
                        flag_text=flag,
                        value_words=None,
                        line=line,
                        page_index=page_index,
                        line_index=line_index,
                        layout="columns",
                    )
                )
            break

        for text in pending_tail:
            parsed = decompose_tail(text)
            if parsed is None:
                continue
            part_unit, part_range, part_flag = parsed
            unit = unit or part_unit
            range_text = range_text or part_range
            flag = flag or part_flag

        while index < total:
            cell_text = cells[index][0]
            parsed = decompose_tail(cell_text)
            if parsed is None:
                # "g/dL 42.0" followed by "- 5.0": a unit plus a split range.
                head, _, tail = cell_text.partition(" ")
                if tail and units.normalize_unit(head).known and FULL_NUMBER.match(tail.strip()):
                    unit = unit or head
                    index += 1
                    if index < total:
                        extraction = ranges.extract_range(f"{tail.strip()} {cells[index][0]}")
                        if extraction is not None:
                            range_text = range_text or extraction.range.text_raw
                            index += 1
                    continue
                break
            part_unit, part_range, part_flag = parsed
            if part_range is not None and range_text is not None:
                break
            unit = unit or part_unit
            range_text = range_text or part_range
            flag = flag or part_flag
            index += 1

        rows.append(
            _make_row(
                name_parts=name_parts,
                value_text=value_text,
                unit_text=unit,
                range_text=range_text,
                flag_text=flag,
                value_words=value_words,
                line=line,
                page_index=page_index,
                line_index=line_index,
                layout="columns",
            )
        )

    for offset, row in enumerate(rows):
        row.key = (page_index, line_index, offset)
    return rows


def parse_line(line: Line, page_index: int, line_index: int) -> List[RawRow]:
    """Extract every test row that appears on one line."""
    cells = [(_cell_text(cell), cell) for cell in line.cells]
    cells = [(text, words) for text, words in cells if text]
    if not cells:
        return []

    if len(cells) == 1:
        return _from_single_cell(cells[0][0], cells[0][1], line, page_index, line_index)
    return _from_columns(cells, line, page_index, line_index)
