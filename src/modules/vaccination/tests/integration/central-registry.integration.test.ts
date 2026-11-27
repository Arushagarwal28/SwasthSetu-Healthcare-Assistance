/**
 * Centralized child vaccination registry, end to end.
 *
 * Covers: facility-neutral registration with an 8-hour grant issued to the
 * registering staff member, no standing facility access, historical doses that
 * never fabricate an administering facility, registry-wide duplicate detection
 * without leaking other workers' child data, cross-worker verification, and
 * activity-based facility statistics.
 */
import './test-env';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../../config/prisma';
import {
  PREFIX, api, cleanupAll, createChildWithDoses, createFacility, createUser, linkStaff,
  startHarness, syntheticMobile, tokenFor,
} from './helpers';
import type { Harness } from './helpers';

let harness: Harness;
let facilityA: string;
let facilityB: string;
let staffAId: string;
let staffAToken: string;
let staffBToken: string;
let adminToken: string;
let helperId: string;
let helperToken: string;
let schedule: { code: string; doseNumber: number };

const DOB = '2024-03-10';

before(async () => {
  harness = await startHarness();

  const admin = await createUser('ADMIN', 'registry-admin');
  adminToken = tokenFor(admin.id, 'ADMIN');

  const a = await createFacility('registry A');
  const b = await createFacility('registry B');
  facilityA = a.id;
  facilityB = b.id;

  const staffA = await createUser('HOSPITAL_STAFF', 'registry-staff-a');
  staffAId = staffA.id;
  staffAToken = tokenFor(staffA.id, 'HOSPITAL_STAFF');
  await linkStaff(staffAId, facilityA);

  const staffB = await createUser('HOSPITAL_STAFF', 'registry-staff-b');
  staffBToken = tokenFor(staffB.id, 'HOSPITAL_STAFF');
  await linkStaff(staffB.id, facilityB);

  const helper = await createUser('HELPER', 'registry-helper');
  helperId = helper.id;
  helperToken = tokenFor(helper.id, 'HELPER');

  // The test database is seeded with the real schedule; use one entry so the
  // registration API and its history rows are independent of hard-coded codes.
  const entry = await prisma.vaccineScheduleEntry.findFirst({
    where: { isActive: true, vaccine: { isActive: true } },
    orderBy: [{ sortOrder: 'asc' }, { doseNumber: 'asc' }],
    select: { doseNumber: true, vaccine: { select: { code: true } } },
  });
  assert.ok(entry, 'the test database must contain an active vaccination schedule');
  schedule = { code: entry.vaccine.code, doseNumber: entry.doseNumber };
});

after(async () => {
  try {
    await cleanupAll();
  } finally {
    // Always release the server and the pool, even if cleanup failed, so a
    // failing assertion can never leave the test runner hanging.
    await harness.close();
  }
});

let registrationSequence = 0;

const registrationBody = (overrides: Record<string, unknown> = {}) => {
  registrationSequence += 1;
  return {
  fullName: `${PREFIX} Registry Child ${registrationSequence}`,
  dateOfBirth: DOB,
  gender: 'MALE',
  motherName: `${PREFIX} Mother ${registrationSequence}`,
  fatherName: `${PREFIX} Father ${registrationSequence}`,
  primaryMobile: syntheticMobile(),
  addressLine: 'Synthetic registry address',
  village: 'Synthetic village',
  district: 'Synthetic district',
  state: 'Synthetic state',
  pinCode: '110001',
  operatingFacilityId: facilityA,
  guardianConsentConfirmed: true,
  ...overrides,
  };
};

const register = (token: string, body: Record<string, unknown>) =>
  api(harness, '/children', { method: 'POST', token, body });

const verify = (token: string, body: Record<string, unknown>) =>
  api(harness, '/children/verify-access', { method: 'POST', token, body });

test('staff registration creates one centralized record and an 8-hour grant, with no facility ownership', async () => {
  const res = await register(staffAToken, registrationBody());
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const child = res.body.data;

  assert.equal(child.assignedFacility, undefined, 'the profile must not expose a permanent facility');
  assert.equal(child.registeredBy.role, 'HOSPITAL_STAFF');

  const grant = await prisma.childAccessGrant.findUnique({
    where: { childId_userId: { childId: child.id, userId: staffAId } },
  });
  assert.ok(grant, 'registration must issue a temporary access grant');
  assert.equal(grant.facilityId, facilityA);
  const hours = (grant.expiresAt.getTime() - Date.now()) / 3_600_000;
  assert.ok(hours > 7.9 && hours <= 8, `the registration grant should last 8 hours, got ${hours}`);

  const audit = await prisma.childAccessAudit.findFirst({
    where: { childId: child.id, actorId: staffAId, action: 'REGISTRATION_GRANT_ISSUED' },
  });
  assert.ok(audit, 'issuing the registration grant must be audited');
  assert.equal(audit.facilityId, facilityA);

  const read = await api(harness, `/children/${child.id}`, { token: staffAToken });
  assert.equal(read.status, 200);
  assert.equal(read.body.data.accessType, 'VERIFIED');

  // The archived permanent link is a separate, inert table and starts empty for
  // a child created after the migration.
  assert.equal(await prisma.childFacilityAssignmentArchive.count({ where: { childId: child.id } }), 0);
});

test('legacy facilityId and missing guardian consent are rejected', async () => {
  const legacy = await register(staffAToken, {
    ...registrationBody(),
    facilityId: facilityA,
  });
  assert.equal(legacy.status, 422, JSON.stringify(legacy.body));
  assert.match(JSON.stringify(legacy.body), /operatingFacilityId/);

  const noConsent = await register(staffAToken, registrationBody({ guardianConsentConfirmed: false }));
  assert.equal(noConsent.status, 422);
  assert.match(JSON.stringify(noConsent.body), /guardian consents/i);
});

test('historical doses never fabricate an administering or encounter facility', async () => {
  const res = await register(
    staffAToken,
    registrationBody({
      history: [
        {
          vaccineCode: schedule.code,
          doseNumber: schedule.doseNumber,
          administeredOn: '2024-03-10',
        },
      ],
    })
  );
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const childId = res.body.data.id as string;

  const dose = await prisma.childDose.findFirst({
    where: { childId, vaccineCode: schedule.code, doseNumber: schedule.doseNumber, isHistorical: true },
  });
  assert.ok(dose);
  assert.equal(dose.administeredFacilityId, null);

  const event = await prisma.childDoseEvent.findFirst({ where: { doseId: dose.id } });
  assert.ok(event);
  assert.equal(event.facilityId, null, 'data entry at registration is not an administration at that facility');
  assert.equal(event.changedById, staffAId, 'the person who entered the information is retained');
});

test('duplicate detection spans the registry and redacts records the worker cannot open', async () => {
  const mobile = syntheticMobile();
  const created = await register(staffAToken, registrationBody({ primaryMobile: mobile }));
  assert.equal(created.status, 201);
  const childId = created.body.data.id as string;

  const otherWorker = await api(harness, `/children/${childId}`, { token: staffBToken });
  assert.equal(otherWorker.status, 404, 'a facility link alone must not reveal another worker’s child');

  const list = await api(harness, '/children?limit=100', { token: staffBToken });
  assert.equal(list.status, 200);
  const ids = (list.body.data.items as { id: string }[]).map((row) => row.id);
  assert.equal(ids.includes(childId), false);

  const duplicate = await register(
    staffBToken,
    registrationBody({
      primaryMobile: mobile,
      fullName: `${PREFIX} Registry Child`,
      operatingFacilityId: facilityB,
    })
  );
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, 'POSSIBLE_DUPLICATES');

  const matches = duplicate.body.data.matches as Record<string, unknown>[];
  assert.ok(matches.length > 0);
  for (const match of matches) {
    assert.equal(match.canView, false);
    assert.equal(match.fullName, null, 'an unauthorized child name must not leak');
    assert.equal(match.recordNumber, null);
    assert.equal(match.dateOfBirth, null);
    assert.equal(match.village, null);
  }

  // Safe workflow: the guardian supplies the record number, the worker verifies
  // the existing record instead of creating a duplicate.
  const row = await prisma.child.findUniqueOrThrow({ where: { id: childId }, select: { recordNumber: true } });
  const recordNumber = `SSV-${String(row.recordNumber).padStart(6, '0')}`;
  const verified = await verify(staffBToken, {
    recordNumber,
    guardianMobile: mobile,
    dateOfBirth: DOB,
    guardianConsentConfirmed: true,
    facilityId: facilityB,
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));

  // Now that the record is legitimately open, the warning may identify it.
  const duplicateAgain = await register(
    staffBToken,
    registrationBody({ primaryMobile: mobile, operatingFacilityId: facilityB })
  );
  assert.equal(duplicateAgain.status, 409);
  const visible = (duplicateAgain.body.data.matches as Record<string, unknown>[]).find(
    (m) => m.id === childId
  );
  assert.ok(visible);
  assert.equal(visible.canView, true);
  assert.equal(typeof visible.fullName, 'string');

  // Confirming registers a genuinely different child.
  const confirmed = await register(
    staffBToken,
    registrationBody({ primaryMobile: mobile, operatingFacilityId: facilityB, confirmDuplicate: true })
  );
  assert.equal(confirmed.status, 201);
});

test('admin statistics describe vaccination activity, never child ownership', async () => {
  const child = await register(staffAToken, registrationBody());
  assert.equal(child.status, 201);
  const childId = child.body.data.id as string;

  const dose = await prisma.childDose.findFirst({
    where: { childId, recordedStatus: 'PENDING' },
    orderBy: { dueDate: 'asc' },
  });
  assert.ok(dose);

  const recorded = await api(harness, `/children/${childId}/doses/${dose.id}`, {
    method: 'PATCH',
    token: staffAToken,
    body: { action: 'ADMINISTERED' },
  });
  assert.equal(recorded.status, 200, JSON.stringify(recorded.body));
  assert.equal(recorded.body.data.administeredFacility.id, facilityA);

  const admin = await api(harness, '/vaccination/admin/stats', { token: adminToken });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.data.children.withoutFacility, undefined);
  assert.equal(admin.body.data.children.topFacilities, undefined);
  assert.ok(Array.isArray(admin.body.data.activity.dosesByFacility));
  assert.ok(admin.body.data.activity.facilitiesWithActivity >= 1);
  assert.equal(admin.body.data.activity.dosesByFacility[0].facilityId, facilityA);

  const mine = await api(harness, '/vaccination/stats', { token: staffAToken });
  assert.equal(mine.status, 200);
  const activity = (mine.body.data.facilityActivity as { facilityId: string }[]).find(
    (row) => row.facilityId === facilityA
  );
  assert.ok(activity, 'staff stats include activity at their linked facilities');
});

test('helper access is unchanged and staff cannot browse helper-registered children', async () => {
  const child = await createChildWithDoses({ label: 'helper-owned', registeredById: helperId, dateOfBirth: DOB });

  const own = await api(harness, `/children/${child.id}`, { token: helperToken });
  assert.equal(own.status, 200);
  assert.equal(own.body.data.accessType, 'OWN');

  const list = await api(harness, '/children?limit=100', { token: helperToken });
  const ids = (list.body.data.items as { id: string }[]).map((row) => row.id);
  assert.ok(ids.includes(child.id));

  const staff = await api(harness, `/children/${child.id}`, { token: staffAToken });
  assert.equal(staff.status, 404);

  const helperVerify = await verify(helperToken, {
    recordNumber: child.recordNumber,
    guardianMobile: child.mobile,
    dateOfBirth: DOB,
    guardianConsentConfirmed: true,
  });
  assert.equal(helperVerify.status, 403);
});
