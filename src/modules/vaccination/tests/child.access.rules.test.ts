/**
 * Run with:
 *   node --require ts-node/register --test "src/modules/vaccination/tests/*.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRecordNumber, formatRecordNumber } from '../child.utils';
import { doseLateness } from '../dose.view';
import { deriveDoseStatus } from '../vaccination.schedule';

test('record numbers are read in the forms staff actually type', () => {
  assert.equal(parseRecordNumber('SSV-000123'), 123);
  assert.equal(parseRecordNumber('ssv 123'), 123);
  assert.equal(parseRecordNumber(' 000123 '), 123);
  assert.equal(parseRecordNumber('123'), 123);
  assert.equal(formatRecordNumber(123), 'SSV-000123');
});

test('record-number parsing never becomes a partial or range search', () => {
  assert.equal(parseRecordNumber(''), null);
  assert.equal(parseRecordNumber(null), null);
  assert.equal(parseRecordNumber('SSV-'), null);
  assert.equal(parseRecordNumber('SSV-000000'), null);
  assert.equal(parseRecordNumber('SSV-1*'), null);
  assert.equal(parseRecordNumber('%'), null);
  assert.equal(parseRecordNumber('SSV-1 OR 1=1'), null);
  assert.equal(parseRecordNumber('9999999999'), null);
});

test('lateness is derived from the scheduled due date, not a status', () => {
  assert.deepEqual(doseLateness('2026-03-01', '2026-03-01'), { wasLate: false, daysLate: 0 });
  assert.deepEqual(doseLateness('2026-03-01', '2026-03-02'), { wasLate: true, daysLate: 1 });
  assert.deepEqual(doseLateness('2026-03-01', '2026-03-11'), { wasLate: true, daysLate: 10 });
  assert.deepEqual(doseLateness('2026-03-01', '2026-02-28'), { wasLate: false, daysLate: 0 });
  assert.deepEqual(doseLateness('2026-03-01', null), { wasLate: false, daysLate: 0 });
});

test('a late dose is still ADMINISTERED: there is no separate LATE status', () => {
  assert.equal(deriveDoseStatus({ recordedStatus: 'ADMINISTERED', dueDate: '2026-03-01' }, '2026-04-01'), 'ADMINISTERED');
  assert.equal(deriveDoseStatus({ recordedStatus: 'POSTPONED', dueDate: '2026-04-10' }, '2026-04-01'), 'POSTPONED');
  assert.equal(deriveDoseStatus({ recordedStatus: 'NOT_GIVEN', dueDate: '2026-03-01' }, '2026-04-01'), 'NOT_GIVEN');
});
