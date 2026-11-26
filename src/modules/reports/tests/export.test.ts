import './test-env';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../config/prisma';
import { buildReportHtml, escapeHtml } from '../report.export.service';
import { toDetailDto } from '../report.mapper';
import { api, seedActors, startHarness, uploadReport, type Actors, type Harness } from './helpers';

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

test('the PDF export is a real attachment and never contains the patient name', async () => {
  const upload = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    title: 'Export check',
    reportDate: '2026-02-02',
  });
  assert.equal(upload.status, 201);
  const reportId = upload.body.data.id as string;

  const response = await fetch(`${harness.apiUrl}/${reportId}/export.pdf`, {
    headers: { Authorization: `Bearer ${actors.patientToken}` },
  });
  const buffer = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok((response.headers.get('content-disposition') ?? '').includes(`${reportId}.pdf`));
  assert.ok(!(response.headers.get('content-disposition') ?? '').includes('Synthetic'));
  assert.equal(buffer.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(buffer.length > 1000, 'the PDF has real content');
});

test('user supplied text is escaped in the export HTML', async () => {
  const upload = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    title: '<script>alert(1)</script>',
    reportDate: '2026-02-03',
  });
  assert.equal(upload.status, 201);
  const reportId = upload.body.data.id as string;

  const row = await prisma.medicalReport.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      tests: true,
      explanations: true,
      corrections: true,
      shares: true,
      patient: { select: { id: true, fullName: true, userId: true } },
    },
  });

  const html = buildReportHtml(toDetailDto(row));

  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal(escapeHtml(`"quoted" & <tag>`), '&quot;quoted&quot; &amp; &lt;tag&gt;');
});

test('the export includes Devanagari content with a Devanagari font stack', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  const reportId = upload.body.data.id as string;

  const row = await prisma.medicalReport.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      tests: true,
      explanations: true,
      corrections: true,
      shares: true,
      patient: { select: { id: true, fullName: true, userId: true } },
    },
  });

  const html = buildReportHtml(toDetailDto(row));
  assert.ok(/[\u0900-\u097f]/.test(html), 'the export contains Hindi text');
  assert.ok(html.includes('Noto Sans Devanagari'));
  assert.ok(html.includes('Nirmala UI'));
  assert.ok(html.includes('charset="utf-8"'));
});

test('an unshared hospital staff member cannot export', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  const reportId = upload.body.data.id as string;

  const response = await api(harness, `/${reportId}/export.pdf`, { token: actors.staffToken });
  assert.equal(response.status, 404);
});
