/**
 * Facility registration codes end to end: policy, creation, hashing,
 * registration, rotation and revocation.
 *
 * Run with:
 *   npm run test:integration
 * (See README.md in this directory for the required TEST_DATABASE_URL.)
 */
import './test-env';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../../../../config/prisma';
import { api, cleanupAll, createUser, PREFIX, startHarness, tokenFor, track } from './helpers';
import type { Harness } from './helpers';

let harness: Harness;
let adminToken: string;

const facilityBody = (label: string, extra: Record<string, unknown> = {}) => ({
  name: `${PREFIX} ${label}`,
  type: 'PHC',
  address: 'Synthetic test address',
  ...extra,
});

const createFacilityViaApi = async (body: Record<string, unknown>) => {
  const res = await api(harness, '/facilities', { method: 'POST', token: adminToken, body });
  if (res.status === 201) track.facility(res.body.data.id as string);
  return res;
};

before(async () => {
  harness = await startHarness();
  const admin = await createUser('ADMIN', 'codes-admin');
  adminToken = tokenFor(admin.id, 'ADMIN');
});

after(async () => {
  await cleanupAll();
  await harness.close();
});

test('short example codes are rejected for production facilities', async () => {
  for (const weak of ['HOSP123', 'PHC123', 'CHC123']) {
    const res = await createFacilityViaApi(facilityBody(`weak-${weak}`, { registrationCode: weak }));
    assert.equal(res.status, 400, `${weak} must be rejected`);
    assert.match(String(res.body.error?.message ?? ''), /12 to 32 characters/);
  }
  assert.equal(
    await prisma.facility.count({ where: { name: { startsWith: `${PREFIX} weak-` } } }),
    0,
    'a rejected code must not leave a facility behind'
  );
});

test('predictable 12-character codes are rejected too', async () => {
  const repeating = await createFacilityViaApi(
    facilityBody('repeat', { registrationCode: 'ABC123ABC123' })
  );
  assert.equal(repeating.status, 400);
  assert.match(String(repeating.body.error?.message ?? ''), /repeated pattern/);

  const lowVariety = await createFacilityViaApi(
    facilityBody('variety', { registrationCode: 'AB12AB12AB12' })
  );
  assert.equal(lowVariety.status, 400);
  assert.match(String(lowVariety.body.error?.message ?? ''), /at least 6 different characters/);
});

test('a compliant custom code creates the facility and is stored only as a hash', async () => {
  const code = 'PHC2026NORTH1';
  const res = await createFacilityViaApi(facilityBody('custom', { registrationCode: code }));
  assert.equal(res.status, 201);
  const facility = res.body.data;
  assert.equal(facility.registrationCode.code, code);

  const stored = await prisma.facilityRegistrationCode.findFirst({
    where: { facilityId: facility.id },
    select: { codeLookup: true },
  });
  assert.ok(stored);
  assert.match(stored.codeLookup, /^[0-9a-f]{64}$/);
  assert.ok(!stored.codeLookup.includes(code), 'the plaintext code must never be stored');
});

test('generated codes remain available and are shown grouped', async () => {
  const res = await createFacilityViaApi(
    facilityBody('generated', { generateRegistrationCode: true })
  );
  assert.equal(res.status, 201);
  assert.match(
    String(res.body.data.registrationCode.code),
    /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
  );
});

test('staff registration with a facility code links the account automatically', async () => {
  const code = 'HOSP2026WEST12';
  const created = await createFacilityViaApi(facilityBody('staff-link', { registrationCode: code }));
  assert.equal(created.status, 201);
  const facilityId = created.body.data.id as string;

  const email = `${PREFIX}-staff-linked@example.test`;
  // Lower case, spaces and dashes are normalised before hashing.
  const res = await api(harness, '/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'Synthetic@1234',
      role: 'HOSPITAL_STAFF',
      facilityRegistrationCode: 'hosp-2026 west 12',
    },
  });
  assert.equal(res.status, 201);
  const staffId = res.body.data.id as string;
  track.user(staffId);
  assert.equal(res.body.data.facility.id, facilityId);

  const link = await prisma.hospitalStaffFacilityLink.findUnique({
    where: { userId_facilityId: { userId: staffId, facilityId } },
  });
  assert.ok(link, 'registration must create the facility link');

  const storedCode = await prisma.facilityRegistrationCode.findFirst({
    where: { facilityId },
    select: { usageCount: true },
  });
  assert.equal(storedCode?.usageCount, 1);
});

test('an unknown code creates no account and gives a generic failure', async () => {
  const email = `${PREFIX}-staff-rejected@example.test`;
  const res = await api(harness, '/auth/register', {
    method: 'POST',
    body: {
      email,
      password: 'Synthetic@1234',
      role: 'HOSPITAL_STAFF',
      facilityRegistrationCode: 'HOSP2026WEST13',
    },
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.message, 'Invalid or expired facility registration code');
  assert.equal(await prisma.user.count({ where: { email } }), 0);
});

test('rotation invalidates the old code immediately and the new one works', async () => {
  const oldCode = 'CHC2026SOUTH2';
  const created = await createFacilityViaApi(
    facilityBody('rotation', { registrationCode: oldCode })
  );
  assert.equal(created.status, 201);
  const facilityId = created.body.data.id as string;

  const rotated = await api(harness, `/facilities/${facilityId}/registration-code/rotate`, {
    method: 'POST',
    token: adminToken,
    body: {},
  });
  assert.equal(rotated.status, 200);
  const newCode = rotated.body.data.code as string;
  assert.notEqual(newCode, oldCode);

  const oldAttempt = await api(harness, '/auth/register', {
    method: 'POST',
    body: {
      email: `${PREFIX}-rotated-old@example.test`,
      password: 'Synthetic@1234',
      role: 'HOSPITAL_STAFF',
      facilityRegistrationCode: oldCode,
    },
  });
  assert.equal(oldAttempt.status, 403);

  const newAttempt = await api(harness, '/auth/register', {
    method: 'POST',
    body: {
      email: `${PREFIX}-rotated-new@example.test`,
      password: 'Synthetic@1234',
      role: 'HOSPITAL_STAFF',
      facilityRegistrationCode: newCode,
    },
  });
  assert.equal(newAttempt.status, 201);
  track.user(newAttempt.body.data.id as string);

  const revoked = await api(harness, `/facilities/${facilityId}/registration-code/revoke`, {
    method: 'POST',
    token: adminToken,
  });
  assert.equal(revoked.status, 200);

  const afterRevoke = await api(harness, '/auth/register', {
    method: 'POST',
    body: {
      email: `${PREFIX}-rotated-revoked@example.test`,
      password: 'Synthetic@1234',
      role: 'HOSPITAL_STAFF',
      facilityRegistrationCode: newCode,
    },
  });
  assert.equal(afterRevoke.status, 403);
});

test('the admin overview reports code status but never a usable code', async () => {
  const code = 'HOSP2026EAST99';
  const created = await createFacilityViaApi(
    facilityBody('overview', { registrationCode: code })
  );
  assert.equal(created.status, 201);
  const facilityId = created.body.data.id as string;

  const overview = await api(harness, '/facilities/admin/overview', { token: adminToken });
  assert.equal(overview.status, 200);
  const row = (overview.body.data.facilities as any[]).find((facility) => facility.id === facilityId);
  assert.ok(row, 'the new facility must appear in the admin overview');
  assert.equal(row.registrationCode.status, 'ACTIVE');
  assert.ok(!('code' in row.registrationCode));
  assert.ok(
    !JSON.stringify(overview.body).includes(code),
    'the overview must never leak a usable code'
  );
});
