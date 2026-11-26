"""Measure structured-extraction accuracy against the synthetic corpus.

Usage (from the ``ml-service`` directory):

    ./venv/Scripts/python.exe medical_report/tools/parsing_accuracy.py

Section 1 parses positioned text directly (layout + parsing).
Section 2 renders a CBC sheet to a PNG, runs the real OCR path and compares the
extracted values with the same expectations.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from medical_report.config import get_settings  # noqa: E402
from medical_report.parsing import parse_document, parse_document_file  # noqa: E402
from medical_report.testing import fixtures, reports  # noqa: E402


def _score(tests, expected: Sequence[Dict[str, Any]]) -> Dict[str, float]:
    by_id: Dict[Optional[str], List[Any]] = {}
    for test in tests:
        by_id.setdefault(test.canonical_id, []).append(test)

    name_hits = value_hits = unit_hits = status_hits = 0
    value_total = unit_total = 0

    for want in expected:
        bucket = by_id.get(want["id"]) or []
        match = bucket.pop(0) if bucket else None
        if match is None:
            continue
        name_hits += 1
        if match.status == want["status"]:
            status_hits += 1
        if "value" in want:
            value_total += 1
            if want["value"] is None:
                value_hits += 1 if match.value_numeric is None else 0
            elif match.value_numeric is not None and abs(match.value_numeric - float(want["value"])) < 1e-6:
                value_hits += 1
        if "unit" in want:
            unit_total += 1
            unit_hits += 1 if match.unit_normalized == want["unit"] else 0

    total = len(expected)
    return {
        "expected": float(total),
        "detected": float(len(tests)),
        "name": name_hits / total if total else 0.0,
        "value": value_hits / value_total if value_total else 1.0,
        "unit": unit_hits / unit_total if unit_total else 1.0,
        "status": status_hits / total if total else 0.0,
    }


def main() -> int:
    settings = get_settings()
    rows: List[tuple] = []
    failures = 0

    for name, pages in reports.REPORTS.items():
        if name not in reports.EXPECTED:
            continue
        document = reports.build_document(pages)
        parsed = parse_document(document)
        scores = _score(parsed.tests, reports.EXPECTED[name])
        ok = scores["name"] >= 0.95 and scores["value"] >= 0.95 and scores["status"] >= 0.95
        failures += 0 if ok else 1
        rows.append((f"text:{name}", scores, "PASS" if ok else "FAIL"))

    with tempfile.TemporaryDirectory() as workdir:
        work = Path(workdir)
        path = work / "cbc-scan.png"
        lines = ["CITY DIAGNOSTIC LABORATORY", "SYNTHETIC SAMPLE - NOT A REAL PATIENT"]
        for row in reports.CBC:
            if len(row) < 4 or row[1] in ("Result",):
                continue
            if len(row) == 1 and row[0].isupper():
                continue
            lines.append(" ".join(cell for cell in row if cell))
        fixtures.render_text_image(lines, font_size=26, line_spacing=1.6).save(path)

        parsed = parse_document_file(str(path), "image", settings)
        scores = _score(parsed.tests, reports.EXPECTED["cbc"])
        ok = scores["value"] >= 0.80 and scores["name"] >= 0.80
        failures += 0 if ok else 1
        rows.append(("ocr:cbc-scan", scores, "PASS" if ok else "FAIL"))

        digital_pdf = work / "cbc.pdf"
        reports.build_report_pdf(digital_pdf, reports.REPORTS["cbc"])
        parsed = parse_document_file(str(digital_pdf), "pdf", settings)
        scores = _score(parsed.tests, reports.EXPECTED["cbc"])
        ok = scores["value"] >= 0.95 and scores["unit"] >= 0.95 and scores["status"] >= 0.95
        failures += 0 if ok else 1
        rows.append(("pdf:cbc", scores, "PASS" if ok else "FAIL"))

    print(f"\n{'case':<20}{'detected':>9}{'name':>8}{'value':>8}{'unit':>8}{'status':>8}  result")
    print("-" * 72)
    for label, scores, status in rows:
        print(
            f"{label:<20}{int(scores['detected']):>4}/{int(scores['expected']):<4}"
            f"{scores['name']:>8.3f}{scores['value']:>8.3f}{scores['unit']:>8.3f}{scores['status']:>8.3f}  {status}"
        )
    print("-" * 72)
    print(f"{len(rows) - failures}/{len(rows)} cases passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
