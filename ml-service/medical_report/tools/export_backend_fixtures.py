"""Export real parse/explain/correct payloads for the Node integration tests.

The backend tests run without a live Python service, so the fixtures they serve
must come from the real pipeline. Regenerate them after changing the parser or
the explanation engine:

    ./venv/Scripts/python.exe -m medical_report.tools.export_backend_fixtures
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from medical_report.explanation.engine import explain_bilingual
from medical_report.parsing import FieldCorrection, apply_corrections, parse_document
from medical_report.testing import reports

CORRECTED_VALUE = "11.0"
CORRECTED_AT = "2026-01-01T00:00:00Z"


def _explanations(report) -> Dict[str, Any]:
    return {language: item.to_dict() for language, item in explain_bilingual(report).items()}


def build_fixtures() -> Dict[str, Any]:
    parsed = parse_document(reports.build_document(reports.REPORTS["cbc"]))
    payload = parsed.to_dict()
    payload["document_id"] = "fixture-cbc"

    hemoglobin = next(test for test in parsed.tests if test.canonical_id == "hemoglobin")
    corrected = apply_corrections(
        parsed,
        [
            FieldCorrection(
                index=hemoglobin.index,
                field="value",
                corrected=CORRECTED_VALUE,
                corrected_by="fixture",
                corrected_at=CORRECTED_AT,
                note="fixture correction",
            )
        ],
    )

    applied = [
        dict(record.to_dict(), index=test.index)
        for test in corrected.tests
        for record in test.corrections
        if record not in hemoglobin.corrections
    ]

    return {
        "parse": payload,
        "explain": _explanations(parsed),
        "correct": {
            "tests": [test.to_dict() for test in corrected.tests],
            "applied": applied,
            "explanations": _explanations(corrected),
        },
    }


def main() -> None:
    root = Path(__file__).resolve().parents[3]
    target = root / "src" / "modules" / "reports" / "tests" / "fixtures"
    target.mkdir(parents=True, exist_ok=True)

    fixtures = build_fixtures()
    for name, payload in fixtures.items():
        path = target / f"cbc.{name}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {path} ({path.stat().st_size} bytes)")

    pdf = target / "cbc.report.pdf"
    reports.build_report_pdf(pdf, reports.REPORTS["cbc"])
    print(f"wrote {pdf} ({pdf.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
