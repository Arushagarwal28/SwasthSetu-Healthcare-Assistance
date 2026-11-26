/**
 * Phase 6 tests: staff lookup, report-type metadata, and patient names.
 *
 * Everything runs against the dedicated test database with synthetic accounts;
 * no development user, patient or report is read or changed.
 */
import './test-env';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../config/prisma';
import {
  api,
  mockState,
  seedActors,
  startHarness,
  uploadReport,
  type Actors,
  type Harness,
} from './helpers';

let harness: Harness;
let actors: Actors;
let facilityId: string;
let staffEmail: string;
let inactiveStaffId: string;

const SUFFIX = Math.random().toString(36).slice(2, 8);
const FACILITY_NAME = `Lookup Test Hospital ${SUFFIX}`;
const INACTIVE_EMAIL = `rpt-test-${SUFFIX}-inactive-staff@example.test`;

before(async () => {
  harness = await startHarness();
  actors = await seedActors();
  mockState.mode = 'ok';

  const facility = await prisma.facility.create({
    data: {
      name: FACILITY_NAME,
      type: 'HOSPITAL',
      address: '1 Synthetic Road',
    },
  });
  facilityId = facility.id;

  await prisma.hospitalStaffFacilityLink.createMany({
    data: [
      { userId: actors.staffUserId, facilityId },
      { userId: actors.otherStaffUserId, facilityId },
    ],
  });

  const inactive = await prisma.user.create({
    data: {
      email: INACTIVE_EMAIL,
      passwordHash: 'not-a-real-hash',
      role: 'HOSPITAL_STAFF',
      isActive: false,
    },
  });
  inactiveStaffId = inactive.id;
  await prisma.hospitalStaffFacilityLink.create({
    data: { userId: inactive.id, facilityId },
  });

  const staff = await prisma.user.findUniqueOrThrow({ where: { id: actors.staffUserId } });
  staffEmail = staff.email;
});

after(async () => {
  await prisma.hospitalStaffFacilityLink.deleteMany({ where: { facilityId } });
  await prisma.facility.deleteMany({ where: { id: facilityId } });
  await prisma.user.deleteMany({ where: { id: inactiveStaffId } });
  await actors.cleanup();
  await harness.close();
});

// ---------------------------------------------------------------------------
// Staff lookup
// ---------------------------------------------------------------------------

test('the staff search refuses queries that could list the directory', async () => {
  const missing = await api(harness, '/share-targets', { token: actors.patientToken });
  assert.equal(missing.status, 422, JSON.stringify(missing.body));

  const tooShort = await api(harness, '/share-targets?q=a', { token: actors.patientToken });
  assert.equal(tooShort.status, 422, JSON.stringify(tooShort.body));

  const tooLarge = await api(harness, '/share-targets?q=lookup&pageSize=50', {
    token: actors.patientToken,
  });
  assert.equal(tooLarge.status, 422, JSON.stringify(tooLarge.body));
});

test('only the roles that may share can search for hospital staff', async () => {
  const helper = await api(harness, '/share-targets?q=Lookup', { token: actors.helperToken });
  assert.equal(helper.status, 200, JSON.stringify(helper.body));

  for (const token of [actors.staffToken, actors.adminToken]) {
    const response = await api(harness, '/share-targets?q=Lookup', { token });
    assert.equal(response.status, 403, JSON.stringify(response.body));
  }

  const anonymous = await api(harness, '/share-targets?q=Lookup');
  assert.equal(anonymous.status, 401, JSON.stringify(anonymous.body));
});

test('a facility search returns active staff only, with no extra account fields', async () => {
  const response = await api<{
    data: { userId: string; email: string; facilities: { id: string; name: string; type: string }[] }[];
    pagination: { total: number; page: number; pageSize: number; pages: number };
  }>(harness, `/share-targets?q=${encodeURIComponent(FACILITY_NAME)}`, {
    token: actors.patientToken,
  });

  assert.equal(response.status, 200, JSON.stringify(response.body));
  const items = response.body.data;
  const ids = items.map((item) => item.userId);

  assert.ok(ids.includes(actors.staffUserId), 'the active staff account is listed');
  assert.ok(ids.includes(actors.otherStaffUserId), 'both active staff accounts are listed');
  assert.ok(!ids.includes(inactiveStaffId), 'a deactivated account is never listed');
  assert.equal(response.body.pagination.total, items.length);

  for (const item of items) {
    assert.deepEqual(Object.keys(item).sort(), ['email', 'facilities', 'userId']);
    assert.ok(item.email.includes('@'), 'staff email is shown for identification');
    assert.ok(item.facilities.some((facility) => facility.name === FACILITY_NAME));
    assert.ok(!JSON.stringify(item).includes('password'), 'no credential material is exposed');
    assert.ok(!('role' in item), 'role is not echoed back');
  }
});

test('an email search matches one account and never leaks a patient', async () => {
  const response = await api<{ data: { userId: string; email: string }[] }>(
    harness,
    `/share-targets?q=${encodeURIComponent(staffEmail)}`,
    { token: actors.patientToken }
  );

  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.length, 1, JSON.stringify(response.body));
  assert.equal(response.body.data[0]?.userId, actors.staffUserId);
  assert.equal(response.body.data[0]?.email, staffEmail);

  // Patients and administrators can never appear, even by email.
  const patientEmail = (
    await prisma.user.findUniqueOrThrow({ where: { id: (await patientUserId(actors.patientId)) } })
  ).email;
  const patientSearch = await api<{ data: unknown[] }>(
    harness,
    `/share-targets?q=${encodeURIComponent(patientEmail.split('@')[0] ?? patientEmail)}`,
    { token: actors.patientToken }
  );
  assert.equal(patientSearch.status, 200);
  assert.deepEqual(patientSearch.body.data, []);
});

test('the staff search is paginated and keeps a stable page size', async () => {
  const first = await api<{ data: unknown[]; pagination: { page: number; pageSize: number } }>(
    harness,
    `/share-targets?q=${encodeURIComponent(FACILITY_NAME)}&page=2&pageSize=1`,
    { token: actors.patientToken }
  );

  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.pagination.page, 2);
  assert.equal(first.body.pagination.pageSize, 1);
  assert.equal(first.body.data.length, 1, 'page 2 holds the second account');
});

async function patientUserId(patientId: string): Promise<string> {
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: { userId: true },
  });
  if (!patient.userId) throw new Error('synthetic patient has no user');
  return patient.userId;
}

// ---------------------------------------------------------------------------
// Patient names in the history list
// ---------------------------------------------------------------------------

test('a report list shows patient names only on rows the caller may read', async () => {
  const emptyForStaff = await api<{ data: { patientName: string | null }[] }>(harness, '/', {
    token: actors.staffToken,
  });
  assert.equal(emptyForStaff.status, 200);
  assert.deepEqual(emptyForStaff.body.data, [], 'nothing is visible before a share');

  const upload = await uploadReport(harness, actors.patientToken, {
    patientId: actors.patientId,
    reportDate: '2026-02-01',
    title: 'Lookup listing report',
  });
  assert.equal(upload.status, 201, JSON.stringify(upload.body));
  const report = upload.body.data as { id: string; patientName: string | null };

  assert.equal(report.patientName, 'Synthetic Patient patient');

  const ownList = await api<{ data: { id: string; patientName: string | null }[] }>(harness, '/', {
    token: actors.patientToken,
  });
  assert.equal(ownList.status, 200);
  const ownRow = ownList.body.data.find((row) => row.id === report.id);
  assert.ok(ownRow);
  assert.equal(ownRow.patientName, 'Synthetic Patient patient');

  const otherList = await api<{ data: { id: string }[] }>(harness, '/', {
    token: actors.otherPatientToken,
  });
  assert.equal(otherList.status, 200);
  assert.deepEqual(otherList.body.data, [], 'another patient sees no row, so no name');

  const otherPatientDetail = await api(harness, `/${report.id}`, {
    token: actors.otherPatientToken,
  });
  assert.equal(otherPatientDetail.status, 404);
  assert.ok(!JSON.stringify(otherPatientDetail.body).includes('Synthetic Patient'));

  const shared = await api(harness, `/${report.id}/share`, {
    method: 'POST',
    token: actors.patientToken,
    body: { userId: actors.staffUserId },
  });
  assert.equal(shared.status, 201, JSON.stringify(shared.body));

  const staffList = await api<{ data: { id: string; patientName: string | null }[] }>(harness, '/', {
    token: actors.staffToken,
  });
  assert.equal(staffList.status, 200);
  assert.equal(staffList.body.data.length, 1);
  assert.equal(staffList.body.data[0]?.patientName, 'Synthetic Patient patient');
});

test('hospital staff cannot see who else a report is shared with', async () => {
  const list = await api<{ data: { id: string }[] }>(harness, '/', {
    token: actors.patientToken,
  });
  const reportId = list.body.data[0]?.id;
  assert.ok(reportId);

  const ownerDetail = await api<{
    data: { shares: { userId: string; email: string | null }[]; patientName: string };
  }>(harness, `/${reportId}`, { token: actors.patientToken });
  assert.equal(ownerDetail.status, 200);
  assert.equal(ownerDetail.body.data.patientName, 'Synthetic Patient patient');
  assert.equal(ownerDetail.body.data.shares.length, 1);
  assert.equal(ownerDetail.body.data.shares[0]?.email, staffEmail);

  const staffDetail = await api<{ data: { shares: unknown[]; patientName: string } }>(
    harness,
    `/${reportId}`,
    { token: actors.staffToken }
  );
  assert.equal(staffDetail.status, 200);
  assert.deepEqual(staffDetail.body.data.shares, [], 'recipients are not disclosed to staff');
  assert.equal(staffDetail.body.data.patientName, 'Synthetic Patient patient');
});

// ---------------------------------------------------------------------------
// Report-type filter metadata
// ---------------------------------------------------------------------------

test('report types come from the reports the caller may actually read', async () => {
  const otherPatient = await api<{ data: unknown[] }>(harness, '/report-types', {
    token: actors.otherPatientToken,
  });
  assert.equal(otherPatient.status, 200);
  assert.deepEqual(otherPatient.body.data, [], 'a patient with no reports gets no options');

  const patient = await api<{ data: { value: string; reportCount: number }[] }>(
    harness,
    '/report-types',
    { token: actors.patientToken }
  );
  assert.equal(patient.status, 200);
  assert.ok(patient.body.data.length >= 1, JSON.stringify(patient.body));
  for (const option of patient.body.data) {
    assert.equal(typeof option.value, 'string');
    assert.ok(option.reportCount >= 1);
  }

  const staff = await api<{ data: { value: string }[] }>(harness, '/report-types', {
    token: actors.staffToken,
  });
  assert.equal(staff.status, 200);
  const staffValues = staff.body.data.map((option) => option.value);
  assert.deepEqual(
    staffValues,
    patient.body.data.map((option) => option.value),
    'staff see the types of the report shared with them'
  );

  const admin = await api(harness, '/report-types', { token: actors.adminToken });
  assert.equal(admin.status, 403, JSON.stringify(admin.body));
});
