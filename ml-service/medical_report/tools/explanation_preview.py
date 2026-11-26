"""Print Phase 3 bilingual explanations for one of the synthetic reports.

Usage (from ``ml-service``)::

    ./venv/Scripts/python.exe medical_report/tools/explanation_preview.py
    ./venv/Scripts/python.exe medical_report/tools/explanation_preview.py --case messy --lang hi
    ./venv/Scripts/python.exe medical_report/tools/explanation_preview.py --case mixed --lang both

Everything is generated from the synthetic corpus in
:mod:`medical_report.testing.reports`; no real patient data is involved.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __package__ in (None, ""):  # allow "python path/to/explanation_preview.py"
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from medical_report.explanation import coverage, explain_report
from medical_report.parsing import parse_document
from medical_report.testing import reports


def build_report(case: str):
    rows = reports.REPORTS[case]
    return parse_document(reports.build_document(rows, document_id=f"preview-{case}"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--case",
        default="mixed",
        choices=sorted(reports.REPORTS),
        help="synthetic report to explain",
    )
    parser.add_argument(
        "--lang",
        default="both",
        choices=("en", "hi", "both"),
        help="language to print",
    )
    args = parser.parse_args(argv)

    languages = ("en", "hi") if args.lang == "both" else (args.lang,)
    report = build_report(args.case)

    print(f"dictionary coverage: {coverage()}")
    print(f"case: {args.case} | tests: {len(report.tests)} | mixed: {report.report.mixed}")

    for language in languages:
        explained = explain_report(report, language)
        print("\n" + "=" * 78)
        print(explained.render())
        print("=" * 78)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
