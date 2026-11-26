"""Unit tests for preprocessing, layout reconstruction and error mapping."""

from __future__ import annotations

import numpy as np
import pytest

from medical_report.config import Settings
from medical_report.errors import DocumentUnreadable, EncryptedDocument, UnsupportedFileType, translate_pdf_error
from medical_report.pipeline import layout, loader, preprocess
from medical_report.pipeline.evaluation import (
    character_error_rate,
    devanagari_ratio,
    word_recall,
)
from medical_report.pipeline.types import Word
from medical_report.testing import fixtures


def _word(text: str, x0: float, x1: float, top: float, bottom: float, confidence=None) -> Word:
    return Word(text=text, x0=x0, x1=x1, top=top, bottom=bottom, confidence=confidence)


def test_sniff_kind_from_magic_bytes():
    assert loader.sniff_kind(b"%PDF-1.7\n...") == "pdf"
    assert loader.sniff_kind(b"\xff\xd8\xff\xe0rest") == "image"
    assert loader.sniff_kind(b"\x89PNG\r\n\x1a\nrest") == "image"
    assert loader.sniff_kind(b"RIFF\x00\x00\x00\x00WEBPVP8 ") == "image"


def test_sniff_rejects_plain_text():
    with pytest.raises(UnsupportedFileType):
        loader.sniff_kind(b"this is not a report")


def test_pdf_error_translation_never_leaks_paths():
    class PDFPasswordIncorrect(Exception):
        pass

    encrypted = translate_pdf_error(PDFPasswordIncorrect("C:/secret/report.pdf is encrypted"))
    assert isinstance(encrypted, EncryptedDocument)
    assert "secret" not in encrypted.message

    corrupt = translate_pdf_error(ValueError("bad xref at C:/secret/report.pdf"))
    assert isinstance(corrupt, DocumentUnreadable)
    assert "secret" not in corrupt.message


def test_deskew_estimates_and_improves_projection():
    image = fixtures.render_text_image(fixtures.REPORT_BODY, rotate=6.0)
    array = np.asarray(image)

    angle = preprocess.estimate_skew(array, 12.0)
    assert 3.0 <= abs(angle) <= 9.0, angle

    corrected = preprocess.warp(array, angle)
    assert preprocess.projection_score(corrected) > preprocess.projection_score(array)


def test_straight_image_is_not_rotated():
    array = np.asarray(fixtures.render_text_image(fixtures.REPORT_BODY))
    assert abs(preprocess.estimate_skew(array, 12.0)) < 1.0


def test_prepare_for_ocr_records_steps(settings: Settings):
    array = np.asarray(fixtures.render_text_image(fixtures.REPORT_BODY, faint=True))

    prepared, meta = preprocess.prepare_for_ocr(array, settings)

    assert prepared.ndim == 2
    assert any("CLAHE" in step for step in meta["steps"])
    assert meta["width_px"] == prepared.shape[1]


def test_words_group_into_lines_and_cells():
    words = [
        _word("Hemoglobin", 10, 90, 20, 32),
        _word("13.4", 200, 230, 20, 32),
        _word("g/dL", 300, 330, 20, 32),
        _word("WBC", 10, 44, 40, 52),
        _word("7200", 200, 234, 40, 52),
    ]

    lines = layout.words_to_lines(words)

    assert len(lines) == 2
    assert lines[0].text == "Hemoglobin 13.4 g/dL"
    assert len(lines[0].cells) == 3


def test_infer_tables_from_cell_alignment():
    words = []
    rows = [("Hemoglobin", "13.4", "g/dL"), ("WBC", "7200", "/uL"), ("Sugar", "142", "mg/dL")]
    for row_index, (name, value, unit) in enumerate(rows):
        top = 20 + row_index * 20
        words.extend(
            [
                _word(name, 10, 90, top, top + 12, confidence=90.0),
                _word(value, 200, 240, top, top + 12, confidence=90.0),
                _word(unit, 320, 360, top, top + 12, confidence=90.0),
            ]
        )

    tables = layout.infer_tables(layout.words_to_lines(words), min_rows=3, min_columns=3)

    assert len(tables) == 1
    assert tables[0].rows[0] == ["Hemoglobin", "13.4", "g/dL"]
    assert tables[0].source == "ocr_heuristic"
    assert tables[0].confidence == pytest.approx(90.0)


def test_metric_helpers():
    reference = "Hemoglobin result value"
    assert word_recall(reference, "Hemoglobin result value") == 1.0
    assert word_recall(reference, "Hemoglobin result") == pytest.approx(2 / 3)
    assert character_error_rate("abcd", "abcd") == 0.0
    assert character_error_rate("abcd", "abxd") == pytest.approx(0.25)
    assert devanagari_ratio("रक्त 142") > 0.5
