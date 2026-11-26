import './test-env';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../config/prisma';
import { api, seedActors, startHarness, type Actors, type Harness } from './helpers';

let harness: Harness;
let actors: Actors;
let uploaderId: string;

interface SyntheticTest {
  canonicalId: string;
  name: string;
  value: number;
  unit: string;
  unitKnown?: boolean;
  status?: 'WITHIN_RANGE' | 'HIGH' | 'LOW' | 'UNKNOWN';
}

before(async () => {
  harness = await startHarness();
  actors = await seedActors();
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: actors.patientId },
    select: { userId: true },
  });
  uploaderId = patient.userId as string;
});

after(async () => {
  await actors.cleanup();
  await harness.close();
});

async function createReport(
  patientId: string,
  reportDate: Date | null,
  tests: SyntheticTest[]
): Promise<string> {
  const report = await prisma.medicalReport.create({
    data: {
      patientId,
      uploadedById: uploaderId,
      uploadedByRole: 'PATIENT',
      fileMimeType: 'application/pdf',
      fileSizeBytes: 128,
      status: 'COMPLETED',
      processedAt: new Date(),
      reportDate,
      reportTypePrimary: 'cbc',
      reportTypeDetected: ['cbc'],
      testCount: tests.length,
      parsedPayload: { report: { primary: 'cbc', detected: ['cbc'], mixed: false }, tests: [] },
    },
  });

  await prisma.medicalReportTest.createMany({
    data: tests.map((item, index) => ({
      reportId: report.id,
      index,
      canonicalId: item.canonicalId,
      canonicalName: item.name,
      category: 'cbc',
      nameRaw: item.name,
      valueRaw: String(item.value),
      valueNumeric: item.value,
      unitRaw: item.unit,
      unitNormalized: item.unit,
      unitKnown: item.unitKnown ?? true,
      status: item.status ?? 'WITHIN_RANGE',
      statusBasis: 'reference_range',
      statusReason: 'synthetic',
    })),
  });

  return report.id;
}

test('reports are compared by their printed date and compatible units', async () => {
  const january = await createReport(actors.patientId, new Date('2026-01-05T00:00:00Z'), [
    { canonicalId: 'hemoglobin', name: 'Hemoglobin', value: 13.4, unit: 'g/dL' },
    { canonicalId: 'wbc', name: 'WBC', value: 7200, unit: '/µL' },
  ]);
  const february = await createReport(actors.patientId, new Date('2026-02-05T00:00:00Z'), [
    { canonicalId: 'hemoglobin', name: 'Hemoglobin', value: 11.2, unit: 'g/dL', status: 'LOW' },
  ]);

  const response = await api(harness, '/compare', {
    method: 'POST',
    token: actors.patientToken,
    body: { reportIds: [february, january] },
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  const data = response.body.data;

  assert.equal(data.orderedBy, 'reportDate');
  assert.equal(data.reports[0].id, january, 'reports are ordered by printed date, not upload order');
  assert.equal(data.reports[1].id, february);

  const hemoglobin = data.comparisons.find((item: any) => item.canonicalId === 'hemoglobin');
  assert.ok(hemoglobin);
  assert.equal(hemoglobin.unit, 'g/dL');
  assert.equal(hemoglobin.change, -2.2);
  assert.equal(hemoglobin.direction, 'down');
  assert.equal(hemoglobin.daysBetween, 31);
  assert.equal(hemoglobin.points.length, 2);

  // WBC exists in only one report, so it is excluded rather than guessed.
  const excluded = data.excluded.map((item: any) => item.test);
  assert.ok(excluded.includes('WBC'));
});

test('incompatible units are excluded', async () => {
  const a = await createReport(actors.patientId, new Date('2026-03-01T00:00:00Z'), [
    { canonicalId: 'creatinine', name: 'Creatinine', value: 0.9, unit: 'mg/dL' },
  ]);
  const b = await createReport(actors.patientId, new Date('2026-04-01T00:00:00Z'), [
    { canonicalId: 'creatinine', name: 'Creatinine', value: 80, unit: 'µmol/L' },
  ]);

  const response = await api(harness, '/compare', {
    method: 'POST',
    token: actors.patientToken,
    body: { reportIds: [a, b] },
  });

  assert.equal(response.status, 200);
  const reasons = response.body.data.excluded.map((item: any) => item.reason);
  assert.ok(reasons.includes('incompatible_or_unknown_unit'));
  assert.equal(
    response.body.data.comparisons.find((item: any) => item.canonicalId === 'creatinine'),
    undefined
  );
});

test('reports without a printed date cannot be compared', async () => {
  const dated = await createReport(actors.patientId, new Date('2026-05-01T00:00:00Z'), [
    { canonicalId: 'hemoglobin', name: 'Hemoglobin', value: 12.5, unit: 'g/dL' },
  ]);
  const undated = await createReport(actors.patientId, null, [
    { canonicalId: 'hemoglobin', name: 'Hemoglobin', value: 12.9, unit: 'g/dL' },
  ]);

  const response = await api(harness, '/compare', {
    method: 'POST',
    token: actors.patientToken,
    body: { reportIds: [dated, undated] },
  });

  assert.equal(response.status, 422);
});

test('reports from different patients are refused', async () => {
  const mine = await createReport(actors.patientId, new Date('2026-06-01T00:00:00Z'), [
    { canonicalId: 'hemoglobin', name: 'Hemoglobin', value: 12.5, unit: 'g/dL' },
  ]);
  const otherPatient = await prisma.patient.findUniqueOrThrow({
    where: { id: actors.otherPatientId },
    select: { userId: true },
  });
  const theirs = await createReport(actors.otherPatientId, new Date('2026-06-02T00:00:00Z'), [
    { canonicalId: 'hemoglobin', name: 'Hemoglobin', value: 12.7, unit: 'g/dL' },
  ]);

  const response = await api(harness, '/compare', {
    method: 'POST',
    token: actors.patientToken,
    body: { reportIds: [mine, theirs] },
  });

  // The other patient's report is not visible at all.
  assert.equal(response.status, 404);

  const asOther = await api(harness, '/compare', {
    method: 'POST',
    token: actors.otherPatientToken,
    body: { reportIds: [mine, theirs] },
  });
  assert.equal(asOther.status, 404);
  assert.ok(otherPatient.userId);
});

test('comparison input is validated', async () => {
  const single = await api(harness, '/compare', {
    method: 'POST',
    token: actors.patientToken,
    body: { reportIds: ['00000000-0000-4000-8000-000000000000'] },
  });
  assert.equal(single.status, 422);

  const notIds = await api(harness, '/compare', {
    method: 'POST',
    token: actors.patientToken,
    body: { reportIds: ['a', 'b'] },
  });
  assert.equal(notIds.status, 422);
});
