"""Synthetic, non-identifiable medical report fixtures for tests and evaluation.

Everything here is fabricated. The report text is deliberately labelled as a
synthetic sample so it can never be mistaken for a real patient's data.
"""

from __future__ import annotations

import os
from typing import Iterable, List, Optional, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ---------------------------------------------------------------------------
# Sample content
# ---------------------------------------------------------------------------

REPORT_HEADER: List[str] = [
    "CITY DIAGNOSTIC LABORATORY",
    "SYNTHETIC SAMPLE - NOT A REAL PATIENT",
    "Patient: SAMPLE PATIENT    Age/Sex: 34 / F",
    "Report Date: 01-Jan-2026    Lab No: SYN-0001",
]

REPORT_BODY: List[str] = [
    "COMPLETE BLOOD COUNT",
    "Hemoglobin 13.4 g/dL 12.0 - 15.0",
    "WBC 7200 /uL 4000 - 11000",
    "Platelet Count 2.1 lakh/uL 1.5 - 4.1",
    "Fasting Blood Sugar 142 mg/dL 70 - 100",
    "Total Cholesterol 196 mg/dL 125 - 200",
]

HINDI_LINES: List[str] = [
    "रक्त परीक्षण रिपोर्ट",
    "हीमोग्लोबिन 13.4",
    "शर्करा 142",
]

TABLE_ROWS: List[List[str]] = [
    ["Test", "Result", "Unit", "Reference"],
    ["Hemoglobin", "13.4", "g/dL", "12.0 - 15.0"],
    ["WBC", "7200", "/uL", "4000 - 11000"],
    ["Fasting Sugar", "142", "mg/dL", "70 - 100"],
    ["Cholesterol", "196", "mg/dL", "125 - 200"],
]


def report_lines() -> List[str]:
    return REPORT_HEADER + [""] + REPORT_BODY


def report_text() -> str:
    return "\n".join(report_lines())


# ---------------------------------------------------------------------------
# Fonts
# ---------------------------------------------------------------------------


A4_INCHES = (8.27, 11.69)


def load_font(size: int, *, devanagari: bool = False) -> ImageFont.FreeTypeFont:
    names = ["Nirmala.ttc", "Nirmala.ttf", "mangal.ttf", "NotoSansDevanagari-Regular.ttf"] if devanagari else [
        "arial.ttf",
        "calibri.ttf",
        "segoeui.ttf",
        "DejaVuSans.ttf",
    ]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    if devanagari:
        raise FileNotFoundError("No Devanagari font is available for the Hindi fixture")
    return ImageFont.load_default(size=size)


def devanagari_available() -> bool:
    try:
        load_font(24, devanagari=True)
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Raster fixtures
# ---------------------------------------------------------------------------


def render_text_image(
    lines: Sequence[str],
    *,
    width: int = 1240,
    height: int = 1754,
    font_size: int = 28,
    margin: int = 90,
    line_spacing: float = 1.6,
    rotate: float = 0.0,
    blur: float = 0.0,
    noise: float = 0.0,
    faint: bool = False,
    devanagari: bool = False,
) -> Image.Image:
    """Draw synthetic text onto a white page, optionally degraded."""
    font = load_font(font_size, devanagari=devanagari)
    image = Image.new("L", (width, height), 255)
    draw = ImageDraw.Draw(image)
    y = margin
    for line in lines:
        if line:
            draw.text((margin, y), line, fill=150 if faint else 0, font=font)
        y += int(font_size * line_spacing)

    if rotate:
        image = image.rotate(rotate, resample=Image.BICUBIC, expand=False, fillcolor=255)
    if blur:
        image = image.filter(ImageFilter.GaussianBlur(blur))
    if noise:
        array = np.asarray(image).astype(np.float32)
        rng = np.random.default_rng(7)
        array = np.clip(array + rng.normal(0, noise, array.shape), 0, 255)
        image = Image.fromarray(array.astype(np.uint8))
    return image


def render_a4_scan(
    lines: Sequence[str],
    *,
    dpi: int = 150,
    font_size: Optional[int] = None,
    margin: Optional[int] = None,
    **kwargs,
) -> Image.Image:
    """Render an A4 page so that ``resolution=dpi`` yields true A4 points."""
    width = int(round(A4_INCHES[0] * dpi))
    height = int(round(A4_INCHES[1] * dpi))
    if font_size is None:
        font_size = max(12, int(round(dpi * 0.19)))
    if margin is None:
        margin = max(24, int(round(dpi * 0.6)))
    return render_text_image(
        lines, width=width, height=height, font_size=font_size, margin=margin, **kwargs
    )


def save_images_as_pdf(images: Sequence[Image.Image], path, resolution: int = 300) -> None:
    first = images[0].convert("RGB")
    rest = [image.convert("RGB") for image in images[1:]]
    first.save(str(path), "PDF", save_all=True, append_images=rest, resolution=resolution)


# ---------------------------------------------------------------------------
# Minimal PDF writer (dependency-free, base-14 Helvetica)
# ---------------------------------------------------------------------------


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text_stream(
    lines: Iterable[str],
    *,
    x: float = 56.0,
    top: float = 790.0,
    font_size: float = 11.0,
    leading: float = 15.0,
) -> str:
    ops = ["BT", f"/F1 {font_size} Tf", f"{leading} TL", f"1 0 0 1 {x} {top} Tm"]
    for line in lines:
        if line:
            ops.append(f"({_escape(line)}) Tj")
        ops.append("T*")
    ops.append("ET")
    return "\n".join(ops)


def table_stream(
    rows: Sequence[Sequence[str]],
    *,
    x: float = 56.0,
    top: float = 720.0,
    column_widths: Sequence[float] = (150.0, 90.0, 90.0, 130.0),
    row_height: float = 22.0,
    font_size: float = 10.0,
) -> str:
    total_width = float(sum(column_widths))
    bottom = top - row_height * len(rows)
    ops = ["q 0.7 w"]
    for index in range(len(rows) + 1):
        y = top - index * row_height
        ops.append(f"{x} {y} m {x + total_width} {y} l S")
    column_x = [x]
    for width in column_widths[:-1]:
        column_x.append(column_x[-1] + float(width))
    column_x.append(x + total_width)
    for position in column_x:
        ops.append(f"{position} {bottom} m {position} {top} l S")
    ops.append("Q")
    ops.append(f"BT /F1 {font_size} Tf")
    for row_index, row in enumerate(rows):
        baseline = top - (row_index + 1) * row_height + 7
        for column_index, cell in enumerate(row):
            if cell:
                ops.append(f"1 0 0 1 {column_x[column_index] + 4} {baseline} Tm ({_escape(cell)}) Tj")
    ops.append("ET")
    return "\n".join(ops)


def build_pdf(path, page_streams: Sequence[str], *, width: float = 595.0, height: float = 842.0) -> None:
    """Write a minimal valid PDF with one page per content stream."""
    count = len(page_streams)
    page_ids = [4 + 2 * index for index in range(count)]
    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)

    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: f"<< /Type /Pages /Kids [{kids}] /Count {count} >>".encode("ascii"),
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    }
    for index, stream in enumerate(page_streams):
        page_id = page_ids[index]
        content_id = page_id + 1
        objects[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>"
        ).encode("ascii")
        data = stream.encode("latin-1", errors="replace")
        objects[content_id] = (
            b"<< /Length " + str(len(data)).encode("ascii") + b" >>\nstream\n" + data + b"\nendstream"
        )

    buffer = bytearray(b"%PDF-1.4\n")
    offsets = {}
    for object_id in sorted(objects):
        offsets[object_id] = len(buffer)
        buffer += f"{object_id} 0 obj\n".encode("ascii") + objects[object_id] + b"\nendobj\n"

    xref_offset = len(buffer)
    max_id = max(objects)
    buffer += f"xref\n0 {max_id + 1}\n".encode("ascii")
    buffer += b"0000000000 65535 f \n"
    for object_id in range(1, max_id + 1):
        buffer += f"{offsets[object_id]:010d} 00000 n \n".encode("ascii")
    buffer += f"trailer\n<< /Size {max_id + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode("ascii")

    with open(path, "wb") as handle:
        handle.write(bytes(buffer))


def build_text_pdf(path, pages: Optional[Sequence[Sequence[str]]] = None, **kwargs) -> None:
    pages = pages or [report_lines()]
    build_pdf(path, [text_stream(page, **kwargs) for page in pages])


def build_table_pdf(path, rows: Optional[Sequence[Sequence[str]]] = None, **kwargs) -> None:
    rows = rows or TABLE_ROWS
    build_pdf(path, [text_stream(REPORT_HEADER[:2]) + "\n" + table_stream(rows, **kwargs)])


def write_bytes(path, data: bytes) -> None:
    with open(path, "wb") as handle:
        handle.write(data)
