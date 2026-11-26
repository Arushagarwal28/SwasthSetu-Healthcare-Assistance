/**
 * Opt-in live smoke test against the real Python service.
 *
 * The default suite is hermetic (a mock service serves recorded fixtures). Run
 * this one when the Python service is actually listening on 8001:
 *
 *   MEDICAL_REPORT_LIVE_PYTHON=1 npm run test:reports
 */
import './test-env';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../../../config/prisma';
import { seedActors, startHarness, type Actors, type Harness } from './helpers';

const enabled = process.env.MEDICAL_REPORT_LIVE_PYTHON === '1';

// When the live run is enabled, talk to the real service instead of the mock.
if (enabled) {
  process.env.MEDICAL_REPORT_SERVICE_URL =
    process.env.LIVE_MEDICAL_REPORT_SERVICE_URL || 'http://127.0.0.1:8001';
  process.env.MEDICAL_REPORT_TIMEOUT_MS = '60000';
}

let harness: Harness;
let actors: Actors;

before(async () => {
  if (!enabled) return;
  harness = await startHarness();
  actors = await seedActors();
});

after(async () => {
  if (!enabled) return;
  await actors.cleanup();
  await harness.close();
});

test('real Python service parses, explains and corrects a report', { skip: !enabled }, async () => {
  const pdfPath = path.join(__dirname, 'fixtures', 'cbc.report.pdf');
  assert.ok(fs.existsSync(pdfPath), 'run the fixture exporter first');

  const form = new FormData();
  form.append(
    'file',
    new Blob([Uint8Array.from(fs.readFileSync(pdfPath))], { type: 'application/pdf' }),
    'cbc.pdf'
  );
  form.append('patientId', actors.patientId);
  form.append('reportDate', '2026-01-05');

  const upload = await fetch(`${harness.apiUrl}/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${actors.patientToken}` },
    body: form,
  });
  const uploaded = (await upload.json()) as any;
  assert.equal(upload.status, 201, JSON.stringify(uploaded));
  assert.equal(uploaded.data.status, 'COMPLETED');
  assert.ok(uploaded.data.testCount >= 10);
  assert.ok(uploaded.data.summary.hi.overview.length > 0);

  const reportId = uploaded.data.id as string;
  const hemoglobin = uploaded.data.tests.find((item: any) => item.canonicalId === 'hemoglobin');
  assert.ok(hemoglobin);

  const correction = await fetch(`${harness.apiUrl}/${reportId}/corrections`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${actors.patientToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      corrections: [{ testId: hemoglobin.id, field: 'value', corrected: '11.0' }],
    }),
  });
  const corrected = (await correction.json()) as any;
  assert.equal(correction.status, 200, JSON.stringify(corrected));

  const updated = corrected.data.tests.find((item: any) => item.canonicalId === 'hemoglobin');
  assert.equal(updated.status, 'LOW');
  assert.equal(updated.extracted.value, hemoglobin.extracted.value);

  const stored = await prisma.medicalReportTest.findUnique({ where: { id: hemoglobin.id } });
  assert.equal(stored?.extractedValueRaw, hemoglobin.extracted.value);
});
