# Medical Report service (Phases 1-3)

Standalone FastAPI service that turns a PDF or photo of a medical report into
positioned text, lines and tables. It is **extraction only**: no diagnosis, no
interpretation, no explanation, no prescription.

* Runs on **port 8001** and never touches the disease-prediction service on
  port 8000 (`ml-service/main.py` is unchanged).
* CPU only. Tesseract 5 with `eng` + `hin`, plus optional `osd` script detection.
* Digital PDFs use their native text layer (exact); OCR runs only for pages
  without usable text.

## Install

```bash
cd ml-service
./venv/Scripts/python.exe -m pip install -r medical_report/requirements-medical.txt
```

Tesseract 5 must be installed and either on `PATH` or pointed at with
`MEDICAL_OCR_TESSERACT_CMD`. Verify with:

```bash
tesseract --version
tesseract --list-langs   # needs eng, hin, osd
```

## Run

```bash
cd ml-service
./venv/Scripts/python.exe -m medical_report.app
# or
./venv/Scripts/python.exe -m uvicorn medical_report.app:app --host 127.0.0.1 --port 8001
```

Interactive docs: <http://127.0.0.1:8001/docs>

## Endpoints

### `GET /health`

Engine availability/version, installed languages, limits and the privacy flags.
Returns `status: "degraded"` (HTTP 200) when Tesseract is missing, so a health
probe never hides a broken install.

### `POST /extract` (multipart/form-data)

| field | required | notes |
| --- | --- | --- |
| `file` | yes | PDF, JPEG, PNG, TIFF, BMP or WEBP; type is sniffed from bytes |
| `langs` | no | comma separated OCR languages, e.g. `eng` or `hin,eng`; validated against installed tessdata |
| `dpi` | no | render DPI for scanned PDFs, clamped to `[150, 600]`, default 300 |
| `max_pages` | no | per-request page cap, never above the server cap |
| `document_id` | no | opaque caller id, `[A-Za-z0-9_-]{1,64}`, echoed back |

Response (abridged):

```json
{
  "success": true,
  "document_id": "doc_123",
  "kind": "pdf",
  "units": "pt",
  "engine": {"name": "tesseract", "version": "5.5.3", "languages": ["eng", "hin", "osd"]},
  "stats": {
    "page_count": 1, "processed_pages": 1, "digital_pages": 1, "ocr_pages": 0,
    "skipped_pages": 0, "word_count": 41, "mean_confidence": null,
    "confidence_pages": 0, "low_confidence_word_ratio": null,
    "dpi": 300, "duration_ms": 38.4
  },
  "warnings": [],
  "pages": [{"index": 0, "source": "pdf_text", "languages": [], "text": "...",
             "lines": [{"text": "...", "cells": [["Hemoglobin"]], "bbox": {}}],
             "tables": [{"rows": [["Test", "Result"]], "source": "pdf_text"}],
             "mean_confidence": null}],
  "text": "...",
  "upload": {"bytes": 2048, "retained": false},
  "request_id": "8f1c..."
}
```

`mean_confidence` is `null` for native PDF text: no recognition happened, so
there is nothing to be uncertain about. OCR pages carry per-word confidences
inside `lines[].cells` plus `low_confidence_word_ratio`.

Errors use one envelope and never echo file content or server paths:

```json
{"success": false, "error": {"code": "unsupported_file_type", "message": "...", "details": {}}}
```

Codes: `invalid_request` (422), `unsupported_file_type` (415), `file_too_large`
(413), `empty_document` (422), `document_unreadable` / `encrypted_document`
(422), `invalid_language` (422), `ocr_unavailable` (503), `ocr_failed` (500),
`internal_error` (500).

## Privacy

* Uploads are spooled to a temporary file with the `swasthsetu-report-` prefix
  and always deleted in a `finally` block, including on errors.
* Nothing about the document is logged: no filenames, no text, no ids beyond a
  generated `request_id`.
* A startup sweep removes stale temp files left by a crashed run
  (`MEDICAL_OCR_STALE_TEMP_MINUTES`, default 60).
* The service keeps no database, no cache and no original file. Persisting
  structured results is the caller's responsibility.

## Configuration

All settings are environment variables (defaults in brackets):

| variable | meaning |
| --- | --- |
| `MEDICAL_OCR_TESSERACT_CMD` | Tesseract binary [auto-detected] |
| `MEDICAL_OCR_DEFAULT_LANGS` | default OCR languages [`eng`] |
| `MEDICAL_OCR_HINDI_LANGS` | languages used when OSD detects Devanagari [`hin,eng`] |
| `MEDICAL_OCR_AUTO_LANG` | enable OSD script detection [`true`] |
| `MEDICAL_OCR_DPI` / `_MIN_DPI` / `_MAX_DPI` | render resolution [300 / 150 / 600] |
| `MEDICAL_OCR_MAX_FILE_MB` | upload cap [20] |
| `MEDICAL_OCR_MAX_PAGES` | page cap [30] |
| `MEDICAL_OCR_DESKEW` | skew correction [`true`] |
| `MEDICAL_OCR_BINARIZE` | `none` \| `otsu` \| `adaptive` [`none`] |
| `MEDICAL_OCR_TEMP_DIR` | temp directory [system temp] |
| `MEDICAL_OCR_STALE_TEMP_MINUTES` | stale sweep age [60] |
| `MEDICAL_OCR_HOST` / `_PORT` | bind address [`127.0.0.1:8001`] |

## Tests

```bash
cd ml-service
./venv/Scripts/python.exe -m pytest medical_report -q
./venv/Scripts/python.exe medical_report/tools/accuracy_report.py
```

Fixtures are generated on the fly from synthetic, clearly-labelled sample text
(`medical_report/testing/fixtures.py`); no real patient data is used.

## Phase 2 - structured parsing

`POST /parse` accepts the same multipart fields as `/extract` plus
`cross_verify` (default `true`) and returns test-level results:

```json
{
  "report": {"primary": "cbc", "detected": ["cbc", "lipid"], "mixed": true, "confidence": 0.72},
  "tests": [{
    "canonical_id": "hemoglobin", "canonical_name": "Hemoglobin", "category": "cbc",
    "name_raw": "Hb", "value_raw": "13.4", "value_numeric": 13.4,
    "unit_raw": "gm/dl", "unit_normalized": "g/dL", "unit_known": true,
    "reference": {"kind": "interval", "low": 12.0, "high": 15.0, "text_raw": "12.0 - 15.0"},
    "status": "WITHIN_RANGE", "status_basis": "reference_range",
    "status_reason": "Reported 13.4; printed reference range is 12.0-15.0.",
    "confidence": 92.0, "needs_review": false, "review_reasons": [],
    "extracted": {"value_raw": "13.4", "value_numeric": 13.4, "unit_raw": "gm/dl"},
    "verification": {"checked": false, "agreement": "not_checked"},
    "source": {"page_index": 0, "line_index": 3, "page_source": "pdf_text", "bbox": {}},
    "corrections": []
  }],
  "unparsed_lines": [], "corrections": [], "warnings": [], "stats": {}
}
```

### Supported categories

CBC, blood glucose (fasting / postprandial / random), HbA1c, lipid profile,
LFT, KFT, thyroid profile and routine urine examination. Report type is
inferred from section headings plus the tests that were parsed; reports mixing
several panels are reported with `mixed: true`. HbA1c counts as part of the
glucose panel, not as a separate report type.

### Status rules (deterministic)

| status | when |
| --- | --- |
| `WITHIN_RANGE` | numeric value inside the printed range, or a qualitative result equal to the printed/expected value |
| `HIGH` / `LOW` | numeric value outside the printed range (bound inclusivity respected), or a laboratory flag with no range |
| `ABNORMAL` | qualitative result that differs from a printed `Negative`/catalogued expectation, or an `A` flag |
| `UNKNOWN` | no value, or a numeric value with no printed range and no flag |
| `NEEDS_REVIEW` | unreadable value, English-OCR disagreement, flag/range conflict, incomparable comparator, ambiguous or unknown test name, unrecognised unit |

A missing range is never filled in. A numeric result with no printed range is
`UNKNOWN`, with the reason recorded - not guessed.

### English cross-verification

Hindi OCR (`hin+eng`) reads Devanagari but can drop digits. For numeric fields
on OCR pages the value box is re-read with `eng` (whitelisted to digits and
`.,<>-`). On disagreement the value is **not** changed: the result becomes
`NEEDS_REVIEW` with `review_reasons=["english_ocr_disagrees"]` and both readings
in `verification`. An empty re-read is `unavailable` and does not penalise the
result.

### Manual corrections

```python
from medical_report.parsing import FieldCorrection, apply_corrections

corrected = apply_corrections(report, [
    FieldCorrection(index=0, field="value", corrected="13.9",
                    corrected_by="user-123", corrected_at="2026-01-01T00:00:00Z",
                    note="checked against the printed report"),
])
```

Supported fields: `value`, `unit`, `reference_range`, `name`. The extracted
originals stay in `extracted_*`; each change appends a `corrections` entry with
original, corrected value, author, timestamp and note, and the status is
recomputed from the corrected data.

### Phase 2 limitations

* Test names outside the catalog are kept but flagged `unknown_test_name`.
* Fuzzy name matching (typos such as `Hcmoglobin`) accepts scores >= 0.86 and
  never overrides an exact alias.
* A value printed as a range (`4-5 /hpf`) is surfaced as unreadable rather than
  converted into a number.
* Section context is inferred from headings; a report with no headings relies on
  unambiguous test names, and ambiguous ones (e.g. `Bilirubin`) are flagged for
  review.
* Column-header units (a unit printed once in the table header) are not
  propagated to individual rows; those rows keep `unit_normalized: null`.

## Phase 3 - bilingual explanation engine

`medical_report/explanation/` turns a `ParsedReport` into patient-facing,
non-diagnostic explanations in English and Hindi. It is fully offline: a
curated dictionary, bilingual templates and the values already parsed in
Phase 2. No API key, no model download, no new dependency.

```python
from medical_report.parsing import parse_document_file
from medical_report.explanation import explain_report, explain_bilingual

parsed = parse_document_file("report.pdf", "pdf")
english = explain_report(parsed, "en")
hindi = explain_report(parsed, "hi")
both = explain_bilingual(parsed)          # {"en": ..., "hi": ...}

print(hindi.render())                     # human-readable block
payload = english.to_dict()               # JSON-ready structure
```

The module exports `explain_test`, `explain_report`, `explain_bilingual` and
the dataclasses `ExplainedReport`, `ReportSummary`, `TestExplanation`.

### Contents

* `types.py` - the explanation data structures.
* `terminology.py` + `terms_cbc.py`, `terms_panels.py`, `terms_urine.py` -
the dictionary: **76 entries, one for every canonical test in the Phase 2
catalog** (coverage is asserted by a test). Each entry has an English and a
Hindi name, a plain-language description of what the test measures, and an
optional note. Entries contain **no reference range and no threshold**.
* `references.py` - the public sources used to build the dictionary (see below).
* `phrases.py` - status wording, review-reason wording, disclaimers, next steps.
* `provider.py` - `ExplanationProvider` (abstract) and the default
`RuleBasedExplanationProvider`, plus `get_provider`/`set_provider`/
`reset_provider` for swapping in a future LLM provider.
* `engine.py` - public entry points and the safety checks.

### What a result explanation contains

1. the test name (localised) and the result **exactly as printed**, with the
   report's own range (`Hemoglobin: 13.4 g/dL (range printed on the report: 12.0 - 15.0)`);
2. what the test measures, from the dictionary;
3. a status sentence for `WITHIN_RANGE`, `HIGH`, `LOW`, `ABNORMAL`, `UNKNOWN` or
   `NEEDS_REVIEW`, phrased only in terms of the printed range;
4. for `NEEDS_REVIEW`, the reason (e.g. both OCR readings `73.4` and `13.4`) and
   a request to verify the line manually - never a direction claim;
5. for corrected fields, a note naming the correction and confirming that the
   software's original reading is still stored;
6. the source ids used for that test's description.

An unknown test keeps the name printed on the report, states that it is not in
the dictionary yet, and still shows its printed value and range.

### Report summary

`ReportSummary` holds a title, an overview with counts (within range / outside /
not classified / awaiting verification), the panels present (so mixed reports
are described as such), key points, next steps and three disclaimers - all in
the requested language. Hindi summaries use natural Devanagari and the same
numbers as the English one.

### Safety guarantees (enforced by `engine.py`)

* The parser output is snapshotted before and after explaining; a provider that
  mutates a value, unit, range, flag or status raises `ExplanationSafetyError`.
* Each explanation echoes `values_used`; if it differs from the parsed result,
  or if the status was changed, the engine refuses to return it. A future LLM
  provider therefore cannot silently restate a number.
* `NEEDS_REVIEW` results are described as unconfirmed and are never turned into
  a high/low finding, even when the parsed number happens to fall outside the
  range.
* No diagnosis, no medicine, no treatment change and no invented range or
  critical threshold appears in any template or dictionary entry (tests scan
  both for banned wording).

### Sources used for the dictionary

| id | source |
| --- | --- |
| `medlineplus-lab-tests` | MedlinePlus (U.S. NLM) medical test library - <https://medlineplus.gov/lab-tests/> |
| `medlineplus-lab-results` | MedlinePlus, "How to Understand Your Lab Results" - <https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/> |
| `labtestsonline` | Lab Tests Online (ADLM/AACC) - <https://labtestsonline.org/> |
| `clsi-ep28` | CLSI EP28-A3c reference-interval guidance (ASCLS provider summary) |
| `icmr-gclp` | ICMR Guidelines for Good Clinical Laboratory Practices 2021 |

Sources are cited for terminology only. Ranges and statuses always come from
the patient's report, never from these sources.

### Preview

```bash
./venv/Scripts/python.exe medical_report/tools/explanation_preview.py --case messy --lang both
```

### Phase 3 limitations

* The dictionary covers the 76 tests in the Phase 2 catalog; anything else is
  shown with its printed value but without a description.
* Descriptions are deliberately generic: they explain what is measured, not what
  a specific deviation means for a specific person.
* Hindi is a single register of plain, formal Devanagari; regional wording and
  transliteration preferences are not configurable yet.
* Explanations are generated per test and per report; there is no cross-test
  reasoning (for example, combining several results into one statement).
* No HTTP endpoint exposes explanations yet - that belongs to the Phase 4
  backend work.

## Known limitations (Phase 1)

* Handwriting is not supported; Tesseract reads printed text only.
* Page `/Rotate` values are reported but pages are not re-oriented before OCR;
  strongly rotated scans rely on deskew (limited to ±12°).
* Digital PDFs with non-Latin text and embedded CID fonts may extract poorly
  because `pdfplumber` returns raw glyph text.
* OCR word bounding boxes are approximated onto the page frame after deskew,
  so they are indicative rather than exact.
* Table detection for scanned pages is heuristic (aligned cell starts), not a
  ruled-table detector.
