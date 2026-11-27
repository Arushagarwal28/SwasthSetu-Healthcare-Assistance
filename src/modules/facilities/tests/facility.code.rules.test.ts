/**
 * Run with:
 *   node --require ts-node/register --test "src/modules/facilities/tests/*.test.ts"
 * No database connection is opened: only the pure code helpers are exercised.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCustomCodePolicy, codeStatus, generateFacilityCode, hashFacilityCode,
  normalizeFacilityCode, CODE_MAX_LENGTH, CODE_MIN_LENGTH, CUSTOM_CODE_MIN_LENGTH,
} from '../facility.code.service';

process.env.FACILITY_CODE_PEPPER = process.env.FACILITY_CODE_PEPPER || 'unit-test-pepper';

test('codes are normalised to a canonical uppercase form', () => {
  assert.equal(normalizeFacilityCode(' hosp-123 '), 'HOSP123');
  assert.equal(normalizeFacilityCode('hosp 123'), 'HOSP123');
  assert.equal(normalizeFacilityCode('HOSP123'), 'HOSP123');
  assert.equal(normalizeFacilityCode(null), '');
});

test('custom codes need at least 12 characters: short examples are rejected', () => {
  assert.equal(CUSTOM_CODE_MIN_LENGTH, 12);
  // The old documented examples are exactly the weak codes that must not work
  // in production any more.
  assert.throws(() => assertCustomCodePolicy('HOSP123'), /12 to 32/);
  assert.throws(() => assertCustomCodePolicy('PHC123'), /12 to 32/);
  assert.throws(() => assertCustomCodePolicy('CHC123'), /12 to 32/);
  assert.throws(() => assertCustomCodePolicy('HOSP1'), /12 to 32/);
  assert.throws(() => assertCustomCodePolicy('A'.repeat(CODE_MAX_LENGTH + 1)), /12 to 32/);

  // Long enough codes with letters and digits are accepted.
  assert.doesNotThrow(() => assertCustomCodePolicy('PHC2026NORTH1'));
  assert.doesNotThrow(() => assertCustomCodePolicy('HOSP1234ABCDE'));
});

test('custom code policy rejects guessable patterns, not just short codes', () => {
  assert.throws(() => assertCustomCodePolicy('HOSPITALCODE'), /letters and digits/);
  assert.throws(() => assertCustomCodePolicy('123456789012'), /letters and digits/);
  assert.throws(() => assertCustomCodePolicy('AB12AB12AB12'), /at least 6 different characters/);
  assert.throws(() => assertCustomCodePolicy('AAAA12345678AB'), /more than 3 times in a row/);
  assert.throws(() => assertCustomCodePolicy('ABC123ABC123'), /repeated pattern/);
});

test('legacy 6-character codes stay acceptable at registration', () => {
  // Existing facilities may still hold shorter codes issued before the policy
  // change; the registration lookup must not silently break their staff links.
  assert.equal(CODE_MIN_LENGTH, 6);
  assert.ok(CODE_MIN_LENGTH < CUSTOM_CODE_MIN_LENGTH);
});

test('generated codes are 12 characters in three readable groups', () => {
  const code = generateFacilityCode();
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  // Ambiguous characters are never generated.
  assert.doesNotMatch(code, /[ILOU01]/);
  assert.equal(normalizeFacilityCode(code).length, CUSTOM_CODE_MIN_LENGTH);
});

test('generated codes are unique across many draws', () => {
  const codes = new Set(Array.from({ length: 200 }, () => generateFacilityCode()));
  assert.equal(codes.size, 200);
});

test('hashing is deterministic, keyed and non-reversible in shape', () => {
  const a = hashFacilityCode('HOSP123');
  assert.equal(a, hashFacilityCode('HOSP123'));
  assert.notEqual(a, hashFacilityCode('HOSP124'));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('HOSP123'));
});

test('a different pepper produces a different lookup value', () => {
  const first = hashFacilityCode('HOSP123');
  process.env.FACILITY_CODE_PEPPER = 'another-pepper';
  assert.notEqual(hashFacilityCode('HOSP123'), first);
  process.env.FACILITY_CODE_PEPPER = 'unit-test-pepper';
});

test('hashing fails closed when the pepper is not configured', () => {
  const saved = process.env.FACILITY_CODE_PEPPER;
  delete process.env.FACILITY_CODE_PEPPER;
  assert.throws(() => hashFacilityCode('HOSP123'), /not configured/);
  process.env.FACILITY_CODE_PEPPER = saved;
});

test('status is ACTIVE, EXPIRED or REVOKED and honours the clock', () => {
  const base = { createdAt: new Date('2026-01-01T00:00:00Z'), revokedAt: null, expiresAt: null };
  assert.equal(codeStatus({ ...base, status: 'ACTIVE' }), 'ACTIVE');
  assert.equal(
    codeStatus({ ...base, status: 'ACTIVE', expiresAt: new Date('2026-01-02T00:00:00Z') }, new Date('2026-01-03T00:00:00Z')),
    'EXPIRED'
  );
  assert.equal(
    codeStatus(
      { ...base, status: 'REVOKED', revokedAt: new Date('2026-01-02T00:00:00Z') },
      new Date('2026-01-03T00:00:00Z')
    ),
    'REVOKED'
  );
});
