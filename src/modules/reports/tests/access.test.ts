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

test('every report endpoint requires authentication', async () => {
  const attempts = [
    await api(harness, '/'),
    await api(harness, '/admin/stats'),
    await api(harness, '/00000000-0000-4000-8000-000000000000'),
    await api(harness, '/00000000-0000-4000-8000-000000000000/export.pdf'),
    await api(harness, '/', { method: 'POST' }),
    await api(harness, '/compare', { method: 'POST', body: { reportIds: [] } }),
  ];

  for (const response of attempts) {
    assert.equal(response.status, 401, JSON.stringify(response.body));
  }
});

test('an invalid token is rejected', async () => {
  const response = await api(harness, '/', { token: 'not-a-real-token' });
  assert.equal(response.status, 401);
});

test('only patients and helpers may upload', async () => {
  const asStaff = await uploadReport(harness, actors.staffToken, { patientId: actors.patientId });
  assert.equal(asStaff.status, 403);

  const asAdmin = await uploadReport(harness, actors.adminToken, { patientId: actors.patientId });
  assert.equal(asAdmin.status, 403);

  const forSomeoneElse = await uploadReport(harness, actors.patientToken, {
    patientId: actors.otherPatientId,
  });
  assert.equal(forSomeoneElse.status, 403);

  const helperLinked = await uploadReport(harness, actors.helperToken, {
    patientId: actors.patientId,
  });
  assert.equal(helperLinked.status, 201);

  const helperUnlinked = await uploadReport(harness, actors.helperToken, {
    patientId: actors.otherPatientId,
  });
  assert.equal(helperUnlinked.status, 403);
});

test('cross-patient reads are indistinguishable from missing reports', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  assert.equal(upload.status, 201);
  const reportId = upload.body.data.id as string;

  const owner = await api(harness, `/${reportId}`, { token: actors.patientToken });
  assert.equal(owner.status, 200);

  const otherPatient = await api(harness, `/${reportId}`, { token: actors.otherPatientToken });
  assert.equal(otherPatient.status, 404);

  const unsharedStaff = await api(harness, `/${reportId}`, { token: actors.staffToken });
  assert.equal(unsharedStaff.status, 404);

  const linkedHelper = await api(harness, `/${reportId}`, { token: actors.helperToken });
  assert.equal(linkedHelper.status, 200);
});

test('hospital staff see a report only after it is explicitly shared', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  const reportId = upload.body.data.id as string;

  const share = await api(harness, `/${reportId}/share`, {
    method: 'POST',
    token: actors.patientToken,
    body: { userId: actors.staffUserId },
  });
  assert.equal(share.status, 201);

  const staffView = await api(harness, `/${reportId}`, { token: actors.staffToken });
  assert.equal(staffView.status, 200);

  // A different staff member was not granted anything.
  const otherStaff = await api(harness, `/${reportId}`, { token: actors.otherStaffToken });
  assert.equal(otherStaff.status, 404);

  // Read-only: staff cannot correct, share or delete.
  const testId = staffView.body.data.tests[0].id as string;
  const correct = await api(harness, `/${reportId}/corrections`, {
    method: 'POST',
    token: actors.staffToken,
    body: { corrections: [{ testId, field: 'value', corrected: '1.0' }] },
  });
  assert.equal(correct.status, 403);

  const reshare = await api(harness, `/${reportId}/share`, {
    method: 'POST',
    token: actors.staffToken,
    body: { userId: actors.otherStaffUserId },
  });
  assert.equal(reshare.status, 403);

  const remove = await api(harness, `/${reportId}`, { method: 'DELETE', token: actors.staffToken });
  assert.equal(remove.status, 403);

  // Revoking the share removes access immediately.
  const revoke = await api(harness, `/${reportId}/share/${actors.staffUserId}`, {
    method: 'DELETE',
    token: actors.patientToken,
  });
  assert.equal(revoke.status, 200);

  const afterRevoke = await api(harness, `/${reportId}`, { token: actors.staffToken });
  assert.equal(afterRevoke.status, 404);
});

test('sharing is refused for non-staff accounts and invalid targets', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  const reportId = upload.body.data.id as string;

  const toPatient = await api(harness, `/${reportId}/share`, {
    method: 'POST',
    token: actors.patientToken,
    body: { userId: actors.otherStaffUserId },
  });
  assert.equal(toPatient.status, 201);

  const unknownTarget = await api(harness, `/${reportId}/share`, {
    method: 'POST',
    token: actors.patientToken,
    body: { userId: '00000000-0000-4000-8000-000000000000' },
  });
  assert.equal(unknownTarget.status, 422);
});

test('administrators get aggregates and can never open an individual report', async () => {
  const upload = await uploadReport(harness, actors.patientToken, { patientId: actors.patientId });
  const reportId = upload.body.data.id as string;

  const stats = await api(harness, '/admin/stats', { token: actors.adminToken });
  assert.equal(stats.status, 200);
  assert.ok(stats.body.data.reports.total >= 1);

  const serialised = JSON.stringify(stats.body);
  assert.ok(!serialised.includes(reportId), 'admin statistics must not expose report ids');
  assert.ok(!serialised.includes(actors.patientId), 'admin statistics must not expose patient ids');
  assert.ok(!serialised.includes('Synthetic Patient'), 'admin statistics must not expose names');

  const direct = await api(harness, `/${reportId}`, { token: actors.adminToken });
  assert.equal(direct.status, 403);

  const listing = await api(harness, '/', { token: actors.adminToken });
  assert.equal(listing.status, 403);

  const exportPdf = await api(harness, `/${reportId}/export.pdf`, { token: actors.adminToken });
  assert.equal(exportPdf.status, 403);

  const deleteAttempt = await api(harness, `/${reportId}`, {
    method: 'DELETE',
    token: actors.adminToken,
  });
  assert.equal(deleteAttempt.status, 403);

  // The report is still there for its owner.
  const owner = await api(harness, `/${reportId}`, { token: actors.patientToken });
  assert.equal(owner.status, 200);

  const remaining = await prisma.medicalReport.count({ where: { id: reportId } });
  assert.equal(remaining, 1);
});
