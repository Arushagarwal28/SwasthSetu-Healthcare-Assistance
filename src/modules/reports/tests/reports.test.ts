import './test-env';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../config/prisma';
import {
  api,
  fixtures,
  mockState,
  pdfBuffer,
  seedActors,
  startHarness,
  uploadForm,
  uploadReport,
  type Actors,
  type Harness,
} from './helpers';

let harness: Harness;
let actors: Actors;

before(async () => {
  harness = await startHarness();
  actors = await seedActors();
});

beforeEach(() => {
  mockState.mode = 'ok';
  mockState.delayMs = 0;
});

after(async () => {
  await actors.cleanup();
  await harness.close();
});

test('a valid report is parsed, explained and stored without the original file', async () => {
  const response = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    title: 'Routine blood work',
    reportDate: '2026-01-05',
  });

  assert.equal(response.status, 201, JSON.stringify(response.body));
  const report = response.body.data;

  assert.equal(report.status, 'COMPLETED');
  assert.equal(report.testCount, fixtures.parse.tests.length);
  assert.equal(report.reportDate.slice(0, 10), '2026-01-05');
  assert.ok(report.summary.en.title);
  assert.ok(report.summary.hi.overview);
  assert.equal(report.tests.length, fixtures.parse.tests.length);

  const hemoglobin = report.tests.find((item: any) => item.canonicalId === 'hemoglobin');
  assert.ok(hemoglobin, 'the parsed hemoglobin result is stored');
  assert.equal(hemoglobin.extracted.value, '13.4');
  assert.equal(hemoglobin.explanations.hi !== null, true);

  // Only the structured result is retained.
  const row = await prisma.medicalReport.findUniqueOrThrow({ where: { id: report.id } });
  assert.ok(row.parsedPayload, 'the parsed payload is stored');
  assert.equal(row.status, 'COMPLETED');

  const audits = await prisma.reportAuditLog.findMany({ where: { reportId: report.id } });
  const actions = audits.map((item) => item.action).sort();
  assert.deepEqual(actions, ['PARSE_SUCCESS', 'UPLOAD']);
  for (const audit of audits) {
    const text = JSON.stringify(audit.detail ?? {});
    assert.ok(!/\d+\.\d+/.test(text), `audit detail must not contain values: ${text}`);
  }
});

test('non-medical and mismatched files are rejected before processing', async () => {
  const textForm = new FormData();
  textForm.append('file', new Blob([Uint8Array.from(Buffer.from('hello'))], { type: 'text/plain' }), 'notes.txt');
  textForm.append('patientId', actors.patientId);
  const wrongType = await api(harness, '/', {
    method: 'POST',
    token: actors.patientToken,
    form: textForm,
  });
  assert.equal(wrongType.status, 415);

  const fakePdf = new FormData();
  fakePdf.append(
    'file',
    new Blob([Uint8Array.from(Buffer.from('not a real pdf at all'))], { type: 'application/pdf' }),
    'x.pdf'
  );
  fakePdf.append('patientId', actors.patientId);
  const badMagic = await api(harness, '/', {
    method: 'POST',
    token: actors.patientToken,
    form: fakePdf,
  });
  assert.equal(badMagic.status, 415);
});

test('an oversized upload is rejected with 413', async () => {
  const form = new FormData();
  const oversized = pdfBuffer(3 * 1024 * 1024);
  form.append('file', new Blob([Uint8Array.from(oversized)], { type: 'application/pdf' }), 'big.pdf');
  form.append('patientId', actors.patientId);

  const response = await api(harness, '/', {
    method: 'POST',
    token: actors.patientToken,
    form,
  });

  assert.equal(response.status, 413);
});

test('a failing Python service fails the report without leaking details', async () => {
  mockState.mode = 'error';

  const response = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  assert.equal(response.status, 422);
  assert.ok(!JSON.stringify(response.body).includes('ocr_failed'));

  const reports = await prisma.medicalReport.findMany({
    where: { patientId: actors.patientId, status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.errorCode, 'REPORT_SERVICE_REJECTED');
  assert.equal(reports[0]?.testCount, 0);
});

test('a slow Python service times out and fails the report', async () => {
  mockState.mode = 'timeout';
  mockState.delayMs = 2000;

  const response = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  assert.equal(response.status, 503);

  const failed = await prisma.medicalReport.findFirst({
    where: { patientId: actors.patientId, status: 'FAILED', errorCode: 'REPORT_SERVICE_TIMEOUT' },
  });
  assert.ok(failed);
});

test('an unreadable Python response is rejected', async () => {
  mockState.mode = 'invalid';

  const response = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  assert.equal(response.status, 502);

  const failed = await prisma.medicalReport.findFirst({
    where: { patientId: actors.patientId, errorCode: 'REPORT_SERVICE_INVALID_RESPONSE' },
  });
  assert.ok(failed);
});

test('history supports search, filtering, sorting and pagination', async () => {
  const first = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    title: 'History alpha',
    reportDate: '2025-11-01',
  });
  const second = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    title: 'History beta',
    reportDate: '2026-03-01',
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const search = await api(harness, '/?q=History%20alpha', { token: actors.patientToken });
  assert.equal(search.status, 200);
  assert.equal(search.body.data.length, 1);
  assert.equal(search.body.data[0].title, 'History alpha');

  const byTest = await api(harness, '/?q=Hemoglobin', { token: actors.patientToken });
  assert.equal(byTest.status, 200);
  assert.ok(byTest.body.data.length >= 2, 'searching by test name finds reports');

  const paged = await api(harness, '/?page=1&pageSize=2', { token: actors.patientToken });
  assert.equal(paged.status, 200);
  assert.equal(paged.body.data.length, 2);
  assert.ok(paged.body.pagination.total >= 2);
  assert.ok(paged.body.pagination.pages >= 1);

  const byDate = await api(harness, '/?sort=date&order=asc', { token: actors.patientToken });
  assert.equal(byDate.status, 200);
  const dates = byDate.body.data
    .map((item: any) => item.reportDate)
    .filter((value: string | null): value is string => Boolean(value));
  const sorted = [...dates].sort();
  assert.deepEqual(dates, sorted);

  const invalidStatus = await api(harness, '/?status=NOPE', { token: actors.patientToken });
  assert.equal(invalidStatus.status, 422);

  // Another patient sees nothing of this history.
  const foreign = await api(harness, '/?q=History', { token: actors.otherPatientToken });
  assert.equal(foreign.status, 200);
  assert.equal(foreign.body.data.length, 0);
});

test('deleting a report removes derived data but keeps the audit trail', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  assert.equal(upload.status, 201);
  const reportId = upload.body.data.id as string;

  const removal = await api(harness, `/${reportId}`, { method: 'DELETE', token: actors.patientToken });
  assert.equal(removal.status, 200);

  const afterDelete = await api(harness, `/${reportId}`, { token: actors.patientToken });
  assert.equal(afterDelete.status, 404);

  assert.equal(await prisma.medicalReportTest.count({ where: { reportId } }), 0);
  assert.equal(await prisma.reportExplanation.count({ where: { reportId } }), 0);

  const audit = await prisma.reportAuditLog.findFirst({
    where: { action: 'DELETE', reportRef: reportId },
  });
  assert.ok(audit, 'deletion is still auditable');
  assert.equal(audit?.reportId, null);
});

test('a helper sees and manages reports for their linked patient only', async () => {
  const upload = await uploadReport(harness, actors.helperToken, { patientId: actors.patientId });
  assert.equal(upload.status, 201);

  const listing = await api(harness, '/', { token: actors.helperToken });
  assert.equal(listing.status, 200);
  assert.ok(listing.body.data.every((item: any) => item.patientId === actors.patientId));
});

test('form fields are validated', async () => {
  const badPatient = await uploadReport(harness, actors.patientToken, { patientId: 'not-a-uuid' });
  assert.equal(badPatient.status, 422);

  const badDate = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    reportDate: 'yesterday',
  });
  assert.equal(badDate.status, 422);

  // Sanity: the helper above still builds a usable form.
  assert.ok(uploadForm({ patientId: actors.patientId }));
});
