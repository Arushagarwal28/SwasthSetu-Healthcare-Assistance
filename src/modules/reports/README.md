# Medical Report Simplifier (backend module)

Upload a printed medical report, read every result with the range that is
printed on the paper, explain the report in English and Hindi, and let the
patient or their helper correct anything the reader got wrong.

Two processes are involved:

| Process | Port | Role |
|---|---|---|
| Node.js API (`src/modules/reports`) | 5000 | auth, authorization, storage, corrections, sharing, comparison, PDF |
| Python OCR/parsing service (`ml-service/medical_report`) | 8001 | PDF text layer, OCR, table/test parsing, deterministic explanation |

The Python service is reachable on loopback only and is meant to sit behind the
Node API. It never stores an uploaded document.

Nothing in this module writes an uploaded document to disk: multer keeps it in
memory, it is streamed to the Python service, and the buffer is dropped when the
request finishes. Only the parsed, structured result is stored.

---

## 1. Processing flow

```
POST /api/v1/reports (multipart: file, patientId, title?, reportDate?, language?)
        │
        ├─ authenticate → authorize(PATIENT|HELPER) → upload rate limit
        ├─ multer memoryStorage: type sniffed from bytes, size capped
        ├─ assertPatientAccess(): patient owns the record, or helper is linked
        ├─ medical_reports row: status=UPLOADED → PROCESSING (audit: UPLOAD)
        ├─ POST {python}/parse   → PDF text layer or OCR (eng+hin), rows parsed,
        │                          cross-verified, each result statused against the
        │                          range printed on the report
        ├─ POST {python}/explain  → EN + HI summary and per-result explanations
        ├─ transaction:
        │     medical_report_tests, report_explanations, report row COMPLETED
        ├─ reportDate taken from the form, else read from the report's own text
        └─ 201 with the full report DTO   (audit: PARSE_SUCCESS)

Any Python failure → report row FAILED + errorCode, 502/503/422 to the caller,
and the document is gone. A FAILED report can only be re-uploaded.
```

Corrections (`POST /:id/corrections`) send the stored payload plus the changed
fields back to `{python}/correct`, which re-classifies the result
deterministically and regenerates both explanations. `extracted*` columns are
never touched; the effective `value*` columns change and a `report_corrections`
row keeps both sides.

---

## 2. Module layout

| File | Purpose |
|---|---|
| `report.routes.ts` | routes, role gates, no-store, staff-search rate limit |
| `report.controller.ts` | request parsing and response envelopes |
| `report.access.ts` | the only place ownership/sharing rules live |
| `report.service.ts` | upload lifecycle, sharing, deletion |
| `report.query.service.ts` | scoped history: search, filters, sorting, pagination |
| `report.lookup.service.ts` | hospital-staff picker and report-type metadata |
| `report.mapper.ts` | DB rows ⇄ Python payload ⇄ API DTOs, status labels |
| `report.compare.service.ts` | 2–5 report comparison, compatibility rules |
| `report.correction.service.ts` | correction workflow + explanation refresh |
| `report.export.service.ts` | bilingual PDF via headless Chromium, HTML escaping |
| `report.admin.service.ts` | aggregate-only statistics with small-bucket suppression |
| `report.audit.service.ts` | audit trail (no medical content, no patient names) |
| `report.python.ts` | Python client: token, timeouts, error translation |
| `report.upload.ts`, `report.storage.ts` | multer, type sniffing, size limits, rate limit |
| `tests/` | hermetic integration tests, live smoke test, exported fixtures |

The same rules are enforced in the services, so a role gate is never the only
protection: an endpoint that forgets `authorize` still goes through
`loadReportForUser` / `visibleReportWhere`.

---

## 3. API (`/api/v1/reports`)

All routes require `Authorization: Bearer <access token>`; responses are
`Cache-Control: no-store`. Uploads are additionally rate limited
(`REPORT_UPLOAD_RATE_LIMIT`, default 20 / 15 min / IP).

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/` | PATIENT, HELPER | Upload + parse + explain (multipart `file`, `patientId`, `title?`, `reportDate?`, `language?`) |
| GET | `/` | PATIENT, HELPER, HOSPITAL_STAFF | History: `q`, `status`, `reportType`, `patientId`, `from`, `to`, `needsReview`, `sort=date\|uploaded`, `order`, `page`, `pageSize` (≤50). Each row carries `patientName` for a report the caller may read |
| GET | `/report-types` | same as history | Complete list of report types **among the caller's visible reports**, with counts. Replaces deriving options from a page sample |
| GET | `/share-targets` | PATIENT, HELPER | Search active hospital staff: `q` (≥2 chars), `page`, `pageSize` (≤10). Returns only `{ userId, email, facilities[] }`; rate limited per account (20/min) |
| GET | `/:id` | owner / linked helper / actively shared staff | Full report, both languages, corrections. Hospital staff receive `shares: []` |
| GET | `/:id/export.pdf` | same as detail | One bilingual PDF (English + Hindi), Chromium text shaping |
| POST | `/:id/corrections` | owner / linked helper | Correct `value`, `unit`, `reference_range` or `name`; status and explanations recalculated |
| POST | `/:id/share` | owner / linked helper | Share with an active HOSPITAL_STAFF user (`userId`, optional future `expiresAt`) |
| DELETE | `/:id/share/:userId` | owner / linked helper | Revoke a share |
| POST | `/compare` | any report reader | Compare 2–5 reports of one patient (printed date, same test, same unit) |
| POST | `/compare/history` | any report reader | Compare the last dated reports for `patientId` + `canonicalId` |
| DELETE | `/:id` | owner / linked helper | Delete the report and derived rows (audit entry kept) |
| GET | `/admin/stats` | ADMIN | Aggregate counts only; buckets below 5 are suppressed |

Status codes: `401` unauthenticated, `403` wrong role, `404` unknown **or**
unauthorized report, `413` too large, `415` file type, `422` validation or
unreadable document, `429` rate limited, `502` bad service response, `503`
service down/timeout.

### Share targets and privacy

The staff picker exists so a patient never has to copy a UUID. It only ever
returns active `HOSPITAL_STAFF` accounts, their sign-in email (the only
identifier such an account has) and the facilities they are linked to. Searches
need two characters, are capped at 10 rows per page and 20 searches per account
per minute, so the endpoint cannot be walked page by page. No patient, helper or
administrator account can be found through it.

### Patient names

`patientName` is added in `report.query.service.ts` from the row's own patient
relation, after `visibleReportWhere` has already scoped the query. A caller who
cannot see the report never sees a row, so the name cannot leak; a hospital
staff account only receives names of patients who shared a report with them.

---

## 4. Data model

| Table | Contents |
|---|---|
| `medical_reports` | patient, uploader + role, status, printed date, type, counts, `parsedPayload`, processing time |
| `medical_report_tests` | one row per result: `extracted*` (never overwritten), effective `value*`, unit, reference range, status, review flags, source position |
| `report_explanations` | EN + HI summary (`scopeKey='summary'`) and per-result explanations (`scopeKey='test:<index>'`) |
| `report_corrections` | field, original, corrected, note, resulting status, actor, time |
| `report_shares` | report, staff user, granted by, expiry, revocation |
| `report_audit_logs` | action, actor + role, structural detail only, request id |

Migrations:

```
prisma/migrations/20261125162818_add_medical_reports/
prisma/migrations/20261125164048_add_report_parsed_payload/
```

Apply with `npx prisma migrate deploy` (or `npx prisma migrate dev` locally).

---

## 5. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection (required) |
| `JWT_ACCESS_SECRET` | — | Access-token signing (required; tests use it to mint tokens) |
| `MEDICAL_REPORT_SERVICE_URL` | `http://127.0.0.1:8001` | Python service origin |
| `MEDICAL_REPORT_TIMEOUT_MS` | `30000` | Per-call timeout for parse/explain/correct |
| `MEDICAL_REPORT_MAX_UPLOAD_MB` | `15` | Upload cap (1–50) |
| `MEDICAL_REPORT_SERVICE_TOKEN` | — | Shared secret sent as `X-Internal-Token`; the Python service rejects requests without it when configured |
| `MEDICAL_REPORT_PDF_CHANNEL` | auto | `chrome`, `msedge`, or empty to try bundled Chromium first |
| `REPORT_UPLOAD_RATE_LIMIT` | `20` | Uploads per IP per 15 minutes |
| `TEST_DATABASE_URL` | `...swasthsetu_test_db` | Test database; must end in `_test_db` |

Python side (see `ml-service/medical_report/README.md`): `MEDICAL_OCR_TESSERACT_CMD`,
`MEDICAL_OCR_LANGS`, `MEDICAL_REPORT_MAX_FILE_MB`, `MEDICAL_REPORT_SERVICE_TOKEN`.

Never commit real values; `.env` is git-ignored and `.env.example` carries names
and placeholders only.

---

## 6. Windows setup

```bash
# 1. Dependencies
npm install
cd frontend && npm install && cd ..
cd ml-service && ./venv/Scripts/python.exe -m pip install -r medical_report/requirements-medical.txt && cd ..

# 2. Database
npx prisma migrate deploy
npx prisma generate

# 3. Python service (port 8001)
cd ml-service
./venv/Scripts/python.exe -m medical_report.app

# 4. Node API (port 5000) — a fresh shell
cd ..
npm run dev          # nodemon + ts-node src/server.ts

# 5. Frontend
cd frontend && npm run dev
```

### Tesseract

* Tesseract 5 with `eng`, `hin` and (recommended) `osd`.
* On `PATH`, or set `MEDICAL_OCR_TESSERACT_CMD` to `tesseract.exe`.
* Verify: `tesseract --version`, `tesseract --list-langs`.
* `GET http://127.0.0.1:8001/health` reports the engine, languages and limits;
  it answers `status: "degraded"` when Tesseract is missing.

### Puppeteer / PDF

* The PDF renderer launches one shared Chromium instance.
* `MEDICAL_REPORT_PDF_CHANNEL` pins the browser (`chrome`, `msedge`); otherwise
  bundled Chromium, installed Chrome, then Edge are tried.
* The shared browser is closed on `SIGINT`/`SIGTERM` (`src/server.ts`), so a
  restart does not leave an orphaned Chromium holding profile locks.
* If PDF export answers 503, the server has no usable browser; install Chrome or
  set the channel.

---

## 7. Tests

```bash
# Hermetic backend suite: mock Python, real test database
npm run test:reports

# Live end-to-end smoke test against the running Python service
MEDICAL_REPORT_LIVE_PYTHON=1 node --require ts-node/register \
  --test "src/modules/reports/tests/live.python.smoke.ts"

# Python unit + API tests
cd ml-service && ./venv/Scripts/python.exe -m pytest medical_report/tests -q
```

The hermetic suite refuses to run unless the database name ends in `_test_db`
(`TEST_DATABASE_URL`, or `ALLOW_NON_TEST_DB=1` to override at your own risk). It
creates and removes its own users, patients, staff accounts, facilities and
reports; the development database is never touched.

Coverage highlights: upload/parse/explain, OCR failure and timeout mapping,
oversized and mismatched files, history search/filter/sort/pagination, helper
linkage, sharing and revocation, comparison compatibility, corrections keeping
the extracted value, export escaping, admin aggregate-only access, staff lookup
authorization/pagination, patient-name scoping and report-type scoping.

Fixtures in `tests/fixtures/` are exported from the real pipeline:

```bash
cd ml-service && ./venv/Scripts/python.exe -m medical_report.tools.export_backend_fixtures
```

---

## 8. Roles

| Role | Sees | Can |
|---|---|---|
| PATIENT | own reports | upload, correct, share, export, compare, delete |
| HELPER | reports of linked patients only | upload, correct, share, export, compare, delete |
| HOSPITAL_STAFF | only reports with an active share | read + export only; recipients are not disclosed |
| ADMIN | aggregate statistics | nothing report-level: every per-report route answers 403 |

A share is active while `revokedAt is null` and (`expiresAt is null` or in the
future). Revoked or expired shares lose list, detail and PDF access
immediately. Unknown and unauthorized ids both answer 404.

---

## 9. Supported reports and known limits

* Catalogue covers common haematology, biochemistry, lipid, thyroid, liver,
  kidney, diabetes and urine panels; unknown tests are kept with their printed
  text and marked as unclassified rather than interpreted.
* Values and ranges are only ever taken from the document. A missing value,
  unit or range is shown as “Not printed” — never invented.
* A result the reader is unsure about is `NEEDS_REVIEW`: it is labelled as
  unverified, listed in the review count and never presented as a finding.
* Comparison needs two reports of the same patient that both carry a printed
  date, the same test and the same normalized unit. Anything else is listed as
  “not compared” instead of being plotted on a misleading scale.
* Very poor scans can yield few or no results; the report is then honest about
  what could not be read. Handwritten reports are not supported.
* Report-type metadata lists types present among visible reports, so a type
  disappears from the filter once the last report of that type is deleted.

---

## 10. Medical safety and privacy

* Explanations are rule-based, deterministic and bilingual; there is no
  diagnosis, no prescription and no dose advice.
* The summary never claims that everything is in range when some results could
  not be classified or are awaiting verification.
* Reference ranges are the ones printed on the report; the product never
  supplies a “normal” range of its own.
* The uploaded document is never stored, logged or served. There is no upload
  directory and no temporary file to leak.
* Audit rows contain the action, actor, role, counts and field names only — no
  values, units, ranges, test names or patient names.
* Logs contain method, path and status; ids appear in paths, medical content
  never does. Error responses never echo the Python service's body.
* Aggregates suppress buckets smaller than 5 and hide the distinct-patient
  count below that threshold.
* PDF HTML escapes every interpolated value (title, name, raw values, units,
  ranges, explanations, reasons).

---

## 11. Deployment requirements

* PostgreSQL with the two migrations applied.
* Node.js 20+ for the API; `JWT_*` secrets, `DATABASE_URL` and
  `MEDICAL_REPORT_SERVICE_URL` supplied by the environment.
* Python 3.11+ with Tesseract 5 (`eng`, `hin`, `osd`) and enough memory/CPU for
  OCR; run it on loopback behind the API, with `MEDICAL_REPORT_SERVICE_TOKEN`
  set on both sides.
* A Chromium/Chrome/Edge binary for PDF export, or accept that export answers
  503 while the rest of the module keeps working.
* Reverse proxy: generous body limit only for `/api/v1/reports` uploads, request
  timeout above `MEDICAL_REPORT_TIMEOUT_MS`, and no response caching for
  `/api/v1/reports/*`.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Upload answers 503 “service is not available” | Python service down or wrong URL/port | Check `GET :8001/health`, `MEDICAL_REPORT_SERVICE_URL` |
| Upload answers 422 “could not be processed” | Document unreadable, or internal token rejected | Confirm `MEDICAL_REPORT_SERVICE_TOKEN` matches on both sides; try a clearer PDF/photo |
| Report FAILED with `REPORT_SERVICE_TIMEOUT` | Large scan, low `MEDICAL_REPORT_TIMEOUT_MS` | Raise the timeout, lower DPI/page cap, retry with fewer pages |
| Hindi text shows as boxes in the PDF | Devanagari font missing in the browser used for rendering | Install Nirmala UI / Noto Sans Devanagari, or set `MEDICAL_REPORT_PDF_CHANNEL` to a browser that has one |
| PDF export 503 | No usable Chromium | Install Chrome/Edge, set `MEDICAL_REPORT_PDF_CHANNEL` |
| 429 on upload or staff search | Rate limit reached | Wait for the window, or raise `REPORT_UPLOAD_RATE_LIMIT` (uploads only) |
| Staff search returns nothing | Query shorter than 2 characters, or the account is inactive | Use the full email or facility name |
| Tests refuse to start | `DATABASE_URL` name does not end in `_test_db` | Set `TEST_DATABASE_URL` to a test database |
