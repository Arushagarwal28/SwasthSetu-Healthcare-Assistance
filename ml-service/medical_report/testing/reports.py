"""Synthetic medical reports with hand-written expected parse results.

All content is fabricated. Reports are expressed as rows of column strings so
they can be turned into positioned text (fast unit tests) or real PDFs
(end-to-end tests) without a PDF library.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Sequence

from medical_report.pipeline.types import DocumentResult, Line, PageResult, Word

COLUMN_STEP = 120.0
FIRST_COLUMN = 40.0
FIRST_LINE_TOP = 780.0
LINE_STEP = 18.0
FONT_HEIGHT = 11.0

CBC: List[List[str]] = [
    ["COMPLETE BLOOD COUNT"],
    ["Test", "Result", "Unit", "Reference Range", "Flag"],
    ["Hemoglobin (Hb)", "13.4", "g/dL", "12.0 - 15.0", ""],
    ["Total Leucocyte Count (TLC)", "7200", "/uL", "4000 - 11000", ""],
    ["Platelet Count", "2.1", "lakh/uL", "1.5 - 4.1", ""],
    ["RBC Count", "4.8", "million/uL", "4.0 - 5.2", ""],
    ["PCV", "41", "%", "36 - 46", ""],
    ["MCV", "86", "fL", "80 - 100", ""],
    ["MCH", "28.5", "pg", "27 - 32", ""],
    ["MCHC", "32.1", "g/dL", "31.5 - 34.5", ""],
    ["RDW", "13.2", "%", "11.5 - 14.5", ""],
    ["Neutrophils", "62", "%", "40 - 75", ""],
    ["Lymphocytes", "30", "%", "20 - 45", ""],
    ["Monocytes", "05", "%", "2 - 10", ""],
    ["Eosinophils", "02", "%", "1 - 6", ""],
    ["Basophils", "01", "%", "0 - 2", ""],
    ["ESR", "18", "mm/hr", "0 - 20", ""],
]

GLUCOSE: List[List[str]] = [
    ["BLOOD SUGAR"],
    ["Fasting Blood Sugar (FBS)", "142", "mg/dL", "70 - 100", "H"],
    ["Postprandial Blood Sugar", "186", "mg/dL", "70 - 140", "H"],
    ["HbA1c", "6.8", "%", "4.0 - 5.6", "H"],
]

LIPID: List[List[str]] = [
    ["LIPID PROFILE"],
    ["Total Cholesterol", "196", "mg/dL", "Up to 200", ""],
    ["Triglycerides", "148", "mg/dL", "< 150", ""],
    ["HDL Cholesterol", "48", "mg/dL", "> 40", ""],
    ["LDL Cholesterol", "118", "mg/dL", "< 100", "H"],
    ["VLDL Cholesterol", "29.6", "mg/dL", "5 - 40", ""],
    ["Total Cholesterol / HDL Ratio", "4.08", "", "3.0 - 5.0", ""],
]

LFT: List[List[str]] = [
    ["LIVER FUNCTION TEST"],
    ["Total Bilirubin", "1.8", "mg/dL", "0.2 - 1.2", "H"],
    ["Direct Bilirubin", "0.6", "mg/dL", "0.0 - 0.3", "H"],
    ["SGPT (ALT)", "68", "U/L", "7 - 56", "H"],
    ["SGOT (AST)", "42", "U/L", "5 - 40", "H"],
    ["Alkaline Phosphatase", "96", "U/L", "40 - 129", ""],
    ["Total Protein", "7.2", "g/dL", "6.4 - 8.3", ""],
    ["Albumin", "4.1", "g/dL", "3.5 - 5.2", ""],
    ["A/G Ratio", "1.32", "", "1.0 - 2.1", ""],
]

KFT: List[List[str]] = [
    ["KIDNEY FUNCTION TEST"],
    ["Blood Urea", "32", "mg/dL", "15 - 40", ""],
    ["Serum Creatinine", "1.4", "mg/dL", "0.7 - 1.3", "H"],
    ["Uric Acid", "6.2", "mg/dL", "3.5 - 7.2", ""],
    ["Sodium", "138", "mEq/L", "135 - 145", ""],
    ["Potassium", "5.6", "mEq/L", "3.5 - 5.1", "H"],
    ["Chloride", "101", "mEq/L", "98 - 107", ""],
    ["Calcium", "9.2", "mg/dL", "8.6 - 10.2", ""],
    ["eGFR", "72", "mL/min/1.73m2", "> 90", "L"],
]

THYROID: List[List[str]] = [
    ["THYROID PROFILE"],
    ["Total T3", "1.1", "ng/mL", "0.8 - 2.0", ""],
    ["Total T4", "8.4", "ug/dL", "5.1 - 14.1", ""],
    ["TSH", "6.2", "uIU/mL", "0.27 - 4.2", "H"],
    ["Free T3", "3.1", "pg/mL", "2.0 - 4.4", ""],
    ["Free T4", "1.1", "ng/dL", "0.93 - 1.7", ""],
]

URINE: List[List[str]] = [
    ["URINE ROUTINE EXAMINATION"],
    ["Colour", "Pale yellow", "", "", ""],
    ["Appearance", "Clear", "", "", ""],
    ["pH", "6.0", "", "5.0 - 8.0", ""],
    ["Specific Gravity", "1.020", "", "1.005 - 1.030", ""],
    ["Protein", "Trace", "", "Negative", "A"],
    ["Glucose", "Negative", "", "Negative", ""],
    ["Ketones", "Negative", "", "Negative", ""],
    ["Blood", "Negative", "", "Negative", ""],
    ["Bilirubin", "Negative", "", "Negative", ""],
    ["Pus Cells", "4-5", "/hpf", "0 - 5", ""],
    ["RBC", "Nil", "/hpf", "0 - 2", ""],
    ["Epithelial Cells", "Few", "/hpf", "0 - 5", ""],
    ["Casts", "Absent", "", "Absent", ""],
    ["Crystals", "Absent", "", "Absent", ""],
    ["Nitrite", "Negative", "", "Negative", ""],
]

MESSY: List[List[str]] = [
    ["Hemoglobin: 13,4 g/dL 12.0 - 15.0"],
    ["WBC 7200 /uL 4000 - 11000", "", "", "", "", "Hemoglobin 13.4 g/dL 12.0 - 15.0"],
    ["Fasting Blood Sugar 142 mg/dL 70 - 100 H"],
    ["Total Cholesterol", "196 mg/dL", "Up to 200"],
    ["Creatinine", "mg/dL"],
    ["Vitamin D (25-OH)", "18", "ng/mL", "30 - 100"],
    ["Hcmoglobin", "11.2", "g/dL", "12.0 - 15.0"],
    ["HbA1c", "1O.5", "%", "4.0 - 5.6"],
    ["", "", "", ""],
    ["Sample collected at", "01-Jan-2026"],
]

REPORTS: Dict[str, List[List[List[str]]]] = {
    "cbc": [CBC],
    "glucose": [GLUCOSE],
    "lipid": [LIPID],
    "lft": [LFT],
    "kft": [KFT],
    "thyroid": [THYROID],
    "urine": [URINE],
    "mixed": [[row for row in CBC] + [[""]] + LIPID, THYROID],
    "messy": [MESSY],
}

REPORT_CATEGORY: Dict[str, str] = {
    "cbc": "cbc",
    "glucose": "glucose",
    "lipid": "lipid",
    "lft": "lft",
    "kft": "kft",
    "thyroid": "thyroid",
    "urine": "urine",
}

EXPECTED: Dict[str, List[Dict[str, object]]] = {
    "cbc": [
        {"id": "hemoglobin", "value": 13.4, "unit": "g/dL", "status": "WITHIN_RANGE"},
        {"id": "wbc_count", "value": 7200.0, "unit": "/µL", "status": "WITHIN_RANGE"},
        {"id": "platelet_count", "value": 2.1, "unit": "lakh/µL", "status": "WITHIN_RANGE"},
        {"id": "rbc_count", "value": 4.8, "unit": "million/µL", "status": "WITHIN_RANGE"},
        {"id": "hematocrit", "value": 41.0, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "mcv", "value": 86.0, "unit": "fL", "status": "WITHIN_RANGE"},
        {"id": "mch", "value": 28.5, "unit": "pg", "status": "WITHIN_RANGE"},
        {"id": "mchc", "value": 32.1, "unit": "g/dL", "status": "WITHIN_RANGE"},
        {"id": "rdw", "value": 13.2, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "neutrophil", "value": 62.0, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "lymphocyte", "value": 30.0, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "monocyte", "value": 5.0, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "eosinophil", "value": 2.0, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "basophil", "value": 1.0, "unit": "%", "status": "WITHIN_RANGE"},
        {"id": "esr", "value": 18.0, "unit": "mm/hr", "status": "WITHIN_RANGE"},
    ],
    "glucose": [
        {"id": "fasting_glucose", "value": 142.0, "unit": "mg/dL", "status": "HIGH"},
        {"id": "postprandial_glucose", "value": 186.0, "unit": "mg/dL", "status": "HIGH"},
        {"id": "hba1c", "value": 6.8, "unit": "%", "status": "HIGH"},
    ],
    "lipid": [
        {"id": "total_cholesterol", "value": 196.0, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "triglycerides", "value": 148.0, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "hdl", "value": 48.0, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "ldl", "value": 118.0, "unit": "mg/dL", "status": "HIGH"},
        {"id": "vldl", "value": 29.6, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "chol_hdl_ratio", "value": 4.08, "unit": None, "status": "WITHIN_RANGE"},
    ],
    "lft": [
        {"id": "total_bilirubin", "value": 1.8, "unit": "mg/dL", "status": "HIGH"},
        {"id": "direct_bilirubin", "value": 0.6, "unit": "mg/dL", "status": "HIGH"},
        {"id": "alt", "value": 68.0, "unit": "U/L", "status": "HIGH"},
        {"id": "ast", "value": 42.0, "unit": "U/L", "status": "HIGH"},
        {"id": "alp", "value": 96.0, "unit": "U/L", "status": "WITHIN_RANGE"},
        {"id": "total_protein", "value": 7.2, "unit": "g/dL", "status": "WITHIN_RANGE"},
        {"id": "albumin", "value": 4.1, "unit": "g/dL", "status": "WITHIN_RANGE"},
        {"id": "ag_ratio", "value": 1.32, "unit": None, "status": "WITHIN_RANGE"},
    ],
    "kft": [
        {"id": "blood_urea", "value": 32.0, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "creatinine", "value": 1.4, "unit": "mg/dL", "status": "HIGH"},
        {"id": "uric_acid", "value": 6.2, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "sodium", "value": 138.0, "unit": "mEq/L", "status": "WITHIN_RANGE"},
        {"id": "potassium", "value": 5.6, "unit": "mEq/L", "status": "HIGH"},
        {"id": "chloride", "value": 101.0, "unit": "mEq/L", "status": "WITHIN_RANGE"},
        {"id": "calcium", "value": 9.2, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "egfr", "value": 72.0, "unit": "mL/min/1.73m²", "status": "LOW"},
    ],
    "thyroid": [
        {"id": "total_t3", "value": 1.1, "unit": "ng/mL", "status": "WITHIN_RANGE"},
        {"id": "total_t4", "value": 8.4, "unit": "µg/dL", "status": "WITHIN_RANGE"},
        {"id": "tsh", "value": 6.2, "unit": "µIU/mL", "status": "HIGH"},
        {"id": "free_t3", "value": 3.1, "unit": "pg/mL", "status": "WITHIN_RANGE"},
        {"id": "free_t4", "value": 1.1, "unit": "ng/dL", "status": "WITHIN_RANGE"},
    ],
    "urine": [
        {"id": "urine_colour", "qualitative": "pale yellow", "unit": None, "status": "UNKNOWN"},
        {"id": "urine_appearance", "qualitative": "clear", "unit": None, "status": "UNKNOWN"},
        {"id": "urine_ph", "value": 6.0, "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_specific_gravity", "value": 1.02, "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_protein", "qualitative": "trace", "unit": None, "status": "ABNORMAL"},
        {"id": "urine_glucose", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_ketones", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_blood", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_bilirubin", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_pus_cells", "qualitative": None, "unit": "/hpf", "status": "NEEDS_REVIEW"},
        {"id": "urine_rbc", "qualitative": "negative", "unit": "/hpf", "status": "WITHIN_RANGE"},
        {"id": "urine_epithelial_cells", "qualitative": "few", "unit": "/hpf", "status": "UNKNOWN"},
        {"id": "urine_casts", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_crystals", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
        {"id": "urine_nitrite", "qualitative": "negative", "unit": None, "status": "WITHIN_RANGE"},
    ],
    "messy": [
        {"id": "hemoglobin", "value": 13.4, "unit": "g/dL", "status": "WITHIN_RANGE"},
        {"id": "wbc_count", "value": 7200.0, "unit": "/µL", "status": "WITHIN_RANGE"},
        {"id": "hemoglobin", "value": 13.4, "unit": "g/dL", "status": "WITHIN_RANGE"},
        {"id": "fasting_glucose", "value": 142.0, "unit": "mg/dL", "status": "HIGH"},
        {"id": "total_cholesterol", "value": 196.0, "unit": "mg/dL", "status": "WITHIN_RANGE"},
        {"id": "creatinine", "value": None, "unit": "mg/dL", "status": "UNKNOWN"},
        {"id": None, "value": 18.0, "unit": "ng/mL", "status": "LOW"},
        {"id": "hemoglobin", "value": 11.2, "unit": "g/dL", "status": "LOW"},
        {"id": "hba1c", "value": None, "unit": "%", "status": "NEEDS_REVIEW"},
    ],
}


def build_document(
    pages: Sequence[Sequence[Sequence[str]]],
    *,
    page_source: str = "pdf_text",
    document_id: Optional[str] = None,
) -> DocumentResult:
    """Build positioned pages directly from column rows (no PDF needed)."""
    page_results: List[PageResult] = []
    confidence = 90.0 if page_source == "ocr" else None

    for page_index, page_rows in enumerate(pages):
        lines: List[Line] = []
        for line_index, row in enumerate(page_rows):
            top = FIRST_LINE_TOP - line_index * LINE_STEP
            bottom = top + FONT_HEIGHT
            cells: List[List[Word]] = []
            parts: List[str] = []
            for column_index, text in enumerate(row):
                if not text:
                    continue
                x0 = FIRST_COLUMN + column_index * COLUMN_STEP
                word = Word(
                    text=str(text),
                    x0=x0,
                    x1=x0 + max(10.0, len(str(text)) * 5.6),
                    top=top,
                    bottom=bottom,
                    confidence=confidence,
                )
                cells.append([word])
                parts.append(str(text))
            if not cells:
                continue
            lines.append(
                Line(
                    text="  ".join(parts),
                    cells=cells,
                    x0=FIRST_COLUMN,
                    x1=FIRST_COLUMN + max(1, len(row)) * COLUMN_STEP,
                    top=top,
                    bottom=bottom,
                    confidence=confidence,
                )
            )

        page_results.append(
            PageResult(
                index=page_index,
                width=595.0,
                height=842.0,
                units="pt",
                source=page_source,
                languages=["eng"] if page_source == "ocr" else [],
                text="\n".join(line.text for line in lines),
                lines=lines,
                tables=[],
                word_count=sum(len(line.cells) for line in lines),
                mean_confidence=confidence,
                low_confidence_word_ratio=0.0 if page_source == "ocr" else None,
                dpi=300 if page_source == "ocr" else None,
            )
        )

    return DocumentResult(
        kind="pdf",
        units="pt",
        engine={"name": "tesseract", "available": True},
        pages=page_results,
        warnings=[],
        stats={"page_count": len(page_results)},
        document_id=document_id,
    )


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def report_stream(rows: Sequence[Sequence[str]], *, top: float = 790.0, line_height: float = 16.0) -> str:
    columns = (56.0, 210.0, 330.0, 410.0, 520.0)
    ops = ["BT", "/F1 10 Tf"]
    y = top
    for row in rows:
        for column_index, cell in enumerate(row):
            if not cell or column_index >= len(columns):
                continue
            ops.append(f"1 0 0 1 {columns[column_index]} {y} Tm ({_escape(str(cell))}) Tj")
        y -= line_height
    ops.append("ET")
    return "\n".join(ops)


def build_report_pdf(path, pages: Sequence[Sequence[Sequence[str]]]) -> None:
    """Write a real multi-column PDF so the full extract+parse path is tested."""
    from medical_report.testing.fixtures import build_pdf

    build_pdf(path, [report_stream(page) for page in pages])
