"""Measure OCR accuracy against synthetic fixtures.

Usage (from the ``ml-service`` directory):

    ./venv/Scripts/python.exe medical_report/tools/accuracy_report.py

Exit code 0 means every case met its expected minimum word recall.
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from medical_report.config import get_settings  # noqa: E402
from medical_report.pipeline.evaluation import summarize  # noqa: E402
from medical_report.pipeline.extract import extract_document  # noqa: E402
from medical_report.testing import fixtures  # noqa: E402

CASES = [
    ("clean scan 150dpi", dict(font_size=26), 0.90),
    ("clean scan 300dpi", dict(font_size=36), 0.90),
    ("faint scan", dict(font_size=30, faint=True), 0.80),
    ("blurred scan", dict(font_size=32, blur=1.2), 0.70),
    ("skewed 5deg", dict(font_size=30, rotate=5.0), 0.75),
    ("noisy scan", dict(font_size=30, noise=12.0), 0.75),
]


def main() -> int:
    settings = get_settings()
    failures = 0
    rows = []

    with tempfile.TemporaryDirectory() as workdir:
        work = Path(workdir)

        for name, options, minimum_recall in CASES:
            path = work / f"{name.replace(' ', '_')}.png"
            fixtures.render_text_image(fixtures.report_lines(), **options).save(path)
            result = extract_document(str(path), "image", settings)
            page = result.pages[0]
            scores = summarize(fixtures.report_text(), page.text)
            ok = scores["recall"] >= minimum_recall
            failures += 0 if ok else 1
            rows.append(
                (
                    name,
                    page.mean_confidence,
                    scores["recall"],
                    scores["precision"],
                    scores["cer"],
                    minimum_recall,
                    "PASS" if ok else "FAIL",
                )
            )

        scanned_pdf = work / "scanned.pdf"
        fixtures.save_images_as_pdf(
            [fixtures.render_text_image(fixtures.report_lines(), font_size=30)], scanned_pdf, resolution=300
        )
        result = extract_document(str(scanned_pdf), "pdf", settings)
        scores = summarize(fixtures.report_text(), result.pages[0].text)
        ok = scores["recall"] >= 0.85 and result.pages[0].source == "ocr"
        failures += 0 if ok else 1
        rows.append(
            (
                "scanned PDF",
                result.pages[0].mean_confidence,
                scores["recall"],
                scores["precision"],
                scores["cer"],
                0.85,
                "PASS" if ok else "FAIL",
            )
        )

        digital_pdf = work / "digital.pdf"
        fixtures.build_text_pdf(digital_pdf, [fixtures.report_lines()])
        result = extract_document(str(digital_pdf), "pdf", settings)
        scores = summarize(fixtures.report_text(), result.pages[0].text)
        ok = scores["recall"] == 1.0 and result.pages[0].source == "pdf_text"
        failures += 0 if ok else 1
        rows.append(("digital PDF (native)", None, scores["recall"], scores["precision"], scores["cer"], 1.0, "PASS" if ok else "FAIL"))

        if fixtures.devanagari_available():
            from PIL import features

            if features.check("raqm"):
                hindi = work / "hindi.png"
                fixtures.render_text_image(
                    fixtures.HINDI_LINES, devanagari=True, font_size=40, line_spacing=2.0
                ).save(hindi)
                result = extract_document(str(hindi), "image", settings, languages=["hin", "eng"])
                page = result.pages[0]
                ratio = sum(1 for char in page.text if "\u0900" <= char <= "\u097F") / max(
                    len(page.text.replace(" ", "")), 1
                )
                ok = ratio >= 0.3
                failures += 0 if ok else 1
                rows.append(("Hindi scan (hin+eng)", page.mean_confidence, ratio, None, None, 0.30, "PASS" if ok else "FAIL"))

    print(f"\nTesseract: {get_settings().tesseract_cmd}")
    print(
        f"{'case':<22}{'mean conf':>10}{'recall':>9}{'precision':>11}{'CER':>8}{'min':>7}  result"
    )
    print("-" * 74)
    for name, confidence, recall, precision, cer, minimum, status in rows:
        conf_text = "-" if confidence is None else f"{confidence:.1f}"
        prec_text = "-" if precision is None else f"{precision:.3f}"
        cer_text = "-" if cer is None else f"{cer:.3f}"
        print(
            f"{name:<22}{conf_text:>10}{recall:>9.3f}{prec_text:>11}{cer_text:>8}{minimum:>7.2f}  {status}"
        )

    print("-" * 74)
    print(f"{len(rows) - failures}/{len(rows)} cases passed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
