import './test-env';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../config/prisma';
import {
  api,
  seedActors,
  startHarness,
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

after(async () => {
  await actors.cleanup();
  await harness.close();
});

async function uploadedReport(): Promise<string> {
  const upload = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    reportDate: '2026-01-05',
  });
  assert.equal(upload.status, 201);
  return upload.body.data.id as string;
}

test('a correction recalculates the status, keeps the original and regenerates explanations', async () => {
  const reportId = await uploadedReport();

  const detail = await api(harness, `/${reportId}`, { token: actors.patientToken });
  assert.equal(detail.status, 200);
  const hemoglobin = detail.body.data.tests.find((item: any) => item.canonicalId === 'hemoglobin');
  assert.equal(hemoglobin.status, 'WITHIN_RANGE');
  const beforeCount = detail.body.data.corrections.length;

  const response = await api(harness, `/${reportId}/corrections`, {
    method: 'POST',
    token: actors.patientToken,
    body: {
      corrections: [
        { testId: hemoglobin.id, field: 'value', corrected: '11.0', note: 'checked on paper' },
      ],
    },
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  const updated = response.body.data;
  const corrected = updated.tests.find((item: any) => item.canonicalId === 'hemoglobin');

  assert.equal(corrected.value.numeric, 11);
  assert.equal(corrected.status, 'LOW');
  assert.equal(corrected.needsReview, false);
  assert.equal(corrected.corrected, true);

  // The extracted original is preserved separately.
  assert.equal(corrected.extracted.value, '13.4');
  assert.equal(corrected.value.raw, '11.0');

  assert.equal(updated.corrections.length, beforeCount + 1);
  const record = updated.corrections[0];
  assert.equal(record.field, 'VALUE');
  assert.equal(record.original, '13.4');
  assert.equal(record.corrected, '11.0');
  assert.equal(record.resultingStatus, 'LOW');
  assert.equal(record.note, 'checked on paper');

  // Both languages were regenerated from the corrected value.
  assert.ok(corrected.explanations.en.result_line.includes('11.0'));
  assert.ok(corrected.explanations.hi.status_text.length > 0);

  const explanations = await prisma.reportExplanation.count({ where: { reportId } });
  assert.ok(explanations >= 2, 'summary and test explanations exist for both languages');

  const audit = await prisma.reportAuditLog.findFirst({
    where: { reportId, action: 'CORRECT' },
  });
  assert.ok(audit);
  const auditText = JSON.stringify(audit?.detail ?? {});
  assert.ok(!auditText.includes('13.4') && !auditText.includes('11.0'), auditText);
  assert.ok(auditText.includes('value'));
});

test('corrections cannot be applied to another patient\'s report', async () => {
  const reportId = await uploadedReport();
  const detail = await api(harness, `/${reportId}`, { token: actors.patientToken });
  const testId = detail.body.data.tests[0].id as string;

  const response = await api(harness, `/${reportId}/corrections`, {
    method: 'POST',
    token: actors.otherPatientToken,
    body: { corrections: [{ testId, field: 'value', corrected: '1.0' }] },
  });

  assert.equal(response.status, 404);
});

test('a test id from a different report is rejected', async () => {
  const reportId = await uploadedReport();
  const otherId = await uploadedReport();
  const other = await api(harness, `/${otherId}`, { token: actors.patientToken });
  const foreignTestId = other.body.data.tests[0].id as string;

  const response = await api(harness, `/${reportId}/corrections`, {
    method: 'POST',
    token: actors.patientToken,
    body: { corrections: [{ testId: foreignTestId, field: 'value', corrected: '1.0' }] },
  });

  assert.equal(response.status, 422);
});

test('only processed reports can be corrected', async () => {
  const report = await prisma.medicalReport.create({
    data: {
      patientId: actors.patientId,
      uploadedById: (await prisma.patient.findUniqueOrThrow({
        where: { id: actors.patientId },
        select: { userId: true },
      })).userId as string,
      uploadedByRole: 'PATIENT',
      fileMimeType: 'application/pdf',
      fileSizeBytes: 10,
      status: 'FAILED',
    },
  });

  const response = await api(harness, `/${report.id}/corrections`, {
    method: 'POST',
    token: actors.patientToken,
    body: {
      corrections: [
        { testId: '00000000-0000-4000-8000-000000000000', field: 'value', corrected: '1.0' },
      ],
    },
  });

  assert.equal(response.status, 409);
});

test('invalid correction payloads are rejected before processing', async () => {
  const reportId = await uploadedReport();
  const detail = await api(harness, `/${reportId}`, { token: actors.patientToken });
  const testId = detail.body.data.tests[0].id as string;

  const badField = await api(harness, `/${reportId}/corrections`, {
    method: 'POST',
    token: actors.patientToken,
    body: { corrections: [{ testId, field: 'diagnosis', corrected: 'x' }] },
  });
  assert.equal(badField.status, 422);

  const empty = await api(harness, `/${reportId}/corrections`, {
    method: 'POST',
    token: actors.patientToken,
    body: { corrections: [] },
  });
  assert.equal(empty.status, 422);
});
