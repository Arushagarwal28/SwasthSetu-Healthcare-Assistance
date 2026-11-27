/**
 * Cross-facility child access end to end: three-field verification, grant
 * scope, facility attribution, and the same-facility workflow it must not
 * disturb.
 *
 * Run with:
 *   npm run test:integration
 * (See README.md in this directory for the required TEST_DATABASE_URL.)
 */
import './test-env';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../../config/prisma';
import {
  api, cleanupAll, createChildWithDoses, createFacility, createUser, linkStaff,
  startHarness, tokenFor,
} from './helpers';
import type { Harness, SyntheticChild } from './helpers';

let harness: Harness;
let facilityA: string;
let facilityB: string;
let adminId: string;
let multiId: string;
let multiToken: string;
let aOnlyId: string;
let aOnlyToken: string;

const TEST_DOB = '2024-01-15';

before(async () => {
  harness = await startHarness();
  const admin = await createUser('ADMIN', 'access-admin');
  adminId = admin.id;

  const facilityARow = await createFacility('access A');
  const facilityBRow = await createFacility('access B');
  facilityA = facilityARow.id;
  facilityB = facilityBRow.id;

  // Linked to BOTH facilities: the case that must not be able to book a
  // cross-facility dose at the other one.
  const multi = await createUser('HOSPITAL_STAFF', 'multi');
  multiId = multi.id;
  multiToken = tokenFor(multi.id, 'HOSPITAL_STAFF');
  await linkStaff(multiId, facilityA);
  await linkStaff(multiId, facilityB);

  // Linked only to facility A: every child at B needs a verification grant.
  const aOnly = await createUser('HOSPITAL_STAFF', 'a-only');
  aOnlyId = aOnly.id;
  aOnlyToken = tokenFor(aOnly.id, 'HOSPITAL_STAFF');
  await linkStaff(aOnlyId, facilityA);
});

after(async () => {
  await cleanupAll();
  await harness.close();
});

const childAtB = (label: string): Promise<SyntheticChild> =>
  createChildWithDoses({
    label,
    registeredById: adminId,
    dateOfBirth: TEST_DOB,
  });

const verify = (token: string, child: SyntheticChild, overrides: Record<string, unknown> = {}) =>
  api(harness, '/children/verify-access', {
    method: 'POST',
    token,
    body: {
      recordNumber: child.recordNumber,
      guardianMobile: child.mobile,
      dateOfBirth: TEST_DOB,
      guardianConsentConfirmed: true,
      ...overrides,
    },
  });

const pendingDoses = (childId: string) =>
  prisma.childDose.findMany({
    where: { childId, recordedStatus: 'PENDING' },
    orderBy: [{ dueDate: 'asc' }, { vaccineCode: 'asc' }],
    select: { id: true },
  });

const recordDose = (token: string, childId: string, doseId: string, body: Record<string, unknown>) =>
  api(harness, `/children/${childId}/doses/${doseId}`, { method: 'PATCH', token, body });

test('verification needs all three identity fields plus the consent attestation', async () => {
  const child = await childAtB('verify-fields');

  const noConsent = await verify(aOnlyToken, child, { guardianConsentConfirmed: false });
  assert.equal(noConsent.status, 422, 'the guardian consent attestation is mandatory');
  assert.equal(
    await prisma.childAccessGrant.count({ where: { childId: child.id, userId: aOnlyId } }),
    0,
    'a request without consent must not create a grant'
  );

  const wrongMobile = await verify(aOnlyToken, child, { guardianMobile: '6000000000' });
  assert.equal(wrongMobile.status, 404);
  assert.equal(
    wrongMobile.body.error.message,
    'These details do not match any child record.',
    'a mismatch must not reveal which field was wrong'
  );

  const wrongDob = await verify(aOnlyToken, child, { dateOfBirth: '2023-01-15' });
  assert.equal(wrongDob.status, 404);

  assert.equal(
    await prisma.childAccessGrant.count({ where: { childId: child.id, userId: aOnlyId } }),
    0
  );
});

test('a grant opens read access to another facility’s child but not personal edits', async () => {
  const child = await childAtB('grant-scope');

  const before = await api(harness, `/children/${child.id}`, { token: aOnlyToken });
  assert.equal(before.status, 404, 'the child is not visible before verification');

  const granted = await verify(aOnlyToken, child);
  assert.equal(granted.status, 200);
  assert.equal(granted.body.data.access.facility.id, facilityA);
  const hours =
    (new Date(granted.body.data.access.expiresAt).getTime() - Date.now()) / 3_600_000;
  assert.ok(hours > 7.9 && hours <= 8, `the grant should last 8 hours, got ${hours}`);

  const after = await api(harness, `/children/${child.id}`, { token: aOnlyToken });
  assert.equal(after.status, 200);
  assert.equal(after.body.data.accessType, 'VERIFIED');
  assert.equal(granted.body.data.child.lastVaccination, null, 'no vaccination is invented');

  const patch = await api(harness, `/children/${child.id}`, {
    method: 'PATCH',
    token: aOnlyToken,
    body: { village: 'Synthetic changed' },
  });
  assert.equal(patch.status, 404, 'a temporary grant never allows personal-data edits');

  const audit = await prisma.childAccessAudit.findFirst({
    where: { childId: child.id, actorId: aOnlyId, action: 'VERIFICATION_SUCCEEDED' },
  });
  assert.ok(audit, 'a successful verification must be audited');
});

test('a dose recorded under a grant is attributed to the grant facility', async () => {
  const child = await childAtB('grant-attribution');
  assert.equal((await verify(aOnlyToken, child)).status, 200);
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);

  const res = await recordDose(aOnlyToken, child.id, dose.id, {
    action: 'ADMINISTERED',
    facilityId: facilityA,
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.administeredFacility.id, facilityA);
  assert.equal(res.body.data.recordedBy.id, aOnlyId);

  const audit = await prisma.childAccessAudit.findFirst({
    where: { childId: child.id, actorId: aOnlyId, action: 'CROSS_FACILITY_DOSE_RECORDED' },
  });
  assert.ok(audit);
  assert.equal((audit.detail as { facilityId?: string }).facilityId, facilityA);
});

test('a grant holder linked to both facilities cannot book the dose at the other one', async () => {
  const child = await childAtB('grant-mismatch');
  // Linked to two active facilities: the encounter facility must be chosen.
  assert.equal((await verify(multiToken, child)).status, 400);
  assert.equal((await verify(multiToken, child, { facilityId: facilityA })).status, 200);
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);

  // Explicitly naming facility B (also linked) must be refused: the grant was
  // issued by facility A and the dose must be attributed there.
  const rejected = await recordDose(multiToken, child.id, dose.id, {
    action: 'ADMINISTERED',
    facilityId: facilityB,
  });
  assert.equal(rejected.status, 403);
  assert.match(String(rejected.body.error.message), /verified at another facility/);

  const unchanged = await prisma.childDose.findUnique({
    where: { id: dose.id },
    select: { recordedStatus: true, administeredFacilityId: true },
  });
  assert.equal(unchanged?.recordedStatus, 'PENDING');
  assert.equal(unchanged?.administeredFacilityId, null);

  // The same dose succeeds when attributed to the grant facility (or omitted,
  // which defaults to it).
  const accepted = await recordDose(multiToken, child.id, dose.id, {
    action: 'ADMINISTERED',
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.data.administeredFacility.id, facilityA);
});

test('facility links alone give no standing access to a child', async () => {
  const child = await childAtB('no-standing-access');
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);

  // No grant for this child: being linked to a facility does not reveal it.
  const read = await api(harness, `/children/${child.id}`, { token: multiToken });
  assert.equal(read.status, 404);

  const write = await recordDose(multiToken, child.id, dose.id, {
    action: 'ADMINISTERED',
    facilityId: facilityB,
  });
  assert.equal(write.status, 404);
});

test('re-verification at another authorized facility moves the grant', async () => {
  const child = await childAtB('reverify');
  assert.equal((await verify(multiToken, child, { facilityId: facilityA })).status, 200);

  const moved = await verify(multiToken, child, { facilityId: facilityB });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.data.access.facility.id, facilityB);

  const grant = await prisma.childAccessGrant.findUnique({
    where: { childId_userId: { childId: child.id, userId: multiId } },
  });
  assert.equal(grant?.facilityId, facilityB);

  // A facility the staff member is linked to but that did not issue the grant is
  // still refused, because the grant now authorizes facility B only.
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);
  const wrong = await recordDose(multiToken, child.id, dose.id, {
    action: 'ADMINISTERED',
    facilityId: facilityA,
  });
  assert.equal(wrong.status, 403);
});

test('a postponed decision records the encounter facility without implying administration', async () => {
  const child = await childAtB('postpone-facility');
  assert.equal((await verify(aOnlyToken, child)).status, 200);
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);

  // The rules cap postponement (and the dose's own horizon); 30 days is valid.
  const newDueDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const res = await recordDose(aOnlyToken, child.id, dose.id, {
    action: 'POSTPONED',
    newDueDate,
    note: 'Synthetic postponement',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.administeredFacility, null);

  const stored = await prisma.childDose.findUnique({ where: { id: dose.id } });
  assert.equal(stored?.administeredFacilityId, null, 'postponing never fabricates an administering facility');

  const event = await prisma.childDoseEvent.findFirst({
    where: { doseId: dose.id, toStatus: 'POSTPONED' },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(event?.facilityId, facilityA, 'the encounter facility is recorded on that event');
});

test('a grant holder cannot reopen or correct the other facility’s record', async () => {
  const child = await childAtB('reopen');
  assert.equal((await verify(aOnlyToken, child)).status, 200);
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);

  const given = await recordDose(aOnlyToken, child.id, dose.id, { action: 'ADMINISTERED' });
  assert.equal(given.status, 200);
  assert.equal(given.body.data.administeredFacility.id, facilityA);

  const reopen = await recordDose(aOnlyToken, child.id, dose.id, {
    action: 'PENDING',
    note: 'Synthetic correction attempt',
  });
  assert.equal(reopen.status, 403);
  assert.match(String(reopen.body.error.message), /another facility/);
});

test('an expired grant stops both reading and recording', async () => {
  const child = await childAtB('expiry');
  assert.equal((await verify(aOnlyToken, child)).status, 200);
  const [dose] = await pendingDoses(child.id);
  assert.ok(dose);

  await prisma.childAccessGrant.update({
    where: { childId_userId: { childId: child.id, userId: aOnlyId } },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });

  const read = await api(harness, `/children/${child.id}`, { token: aOnlyToken });
  assert.equal(read.status, 404);

  const write = await recordDose(aOnlyToken, child.id, dose.id, {
    action: 'ADMINISTERED',
    facilityId: facilityA,
  });
  assert.equal(write.status, 404);
});
