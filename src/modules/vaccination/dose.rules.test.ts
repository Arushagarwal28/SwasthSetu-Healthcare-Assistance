/**
 * Run with:  npx tsx src/modules/vaccination/dose.rules.test.ts
 */
import { planDoseChange, buildDoseNote, BATCH_PATTERN, MAX_POSTPONE_DAYS } from './dose.rules';
import type { DoseChangeResult, DoseState } from './dose.rules';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);

const TODAY = '2026-11-22';
const DOB = '2026-01-10';
const pending: DoseState = { recordedStatus: 'PENDING', dueDate: '2026-11-20' }; // overdue
const given: DoseState = { recordedStatus: 'ADMINISTERED', dueDate: '2026-11-20' };
const notGiven: DoseState = { recordedStatus: 'NOT_GIVEN', dueDate: '2026-11-20' };
const postponed: DoseState = { recordedStatus: 'POSTPONED', dueDate: '2026-12-01' };

const run = (s: DoseState, input: Parameters<typeof planDoseChange>[2]): DoseChangeResult =>
  planDoseChange(s, DOB, input, TODAY);
const isErr = (r: DoseChangeResult, status?: number) => !r.ok && (status === undefined || r.status === status);

// ---------- ADMINISTERED ----------
{
  const r = run(pending, { action: 'ADMINISTERED' });
  check('administer: defaults the date to today', r.ok && r.plan.administeredOn === TODAY && r.plan.toStatus === 'ADMINISTERED');
  check('administer: keeps the due date', r.ok && r.plan.dueDate === '2026-11-20');
}
check('administer: explicit past date', (() => {
  const r = run(pending, { action: 'ADMINISTERED', administeredOn: '2026-11-18' });
  return r.ok && r.plan.administeredOn === '2026-11-18';
})());
check('administer: today is allowed', run(pending, { action: 'ADMINISTERED', administeredOn: TODAY }).ok);
check('administer: future date rejected', isErr(run(pending, { action: 'ADMINISTERED', administeredOn: '2026-11-23' }), 400));
check('administer: before DOB rejected', isErr(run(pending, { action: 'ADMINISTERED', administeredOn: '2026-01-09' }), 400));
check('administer: on the DOB is allowed (birth dose)', run(pending, { action: 'ADMINISTERED', administeredOn: DOB }).ok);
check('administer: impossible date rejected', isErr(run(pending, { action: 'ADMINISTERED', administeredOn: '2026-02-30' }), 400));
check('administer: already given -> 409', isErr(run(given, { action: 'ADMINISTERED' }), 409));
check('administer: from POSTPONED is allowed', run(postponed, { action: 'ADMINISTERED' }).ok);
check('administer: from NOT_GIVEN is allowed', run(notGiven, { action: 'ADMINISTERED' }).ok);
{
  const r = run(pending, { action: 'ADMINISTERED', batchNumber: 'AB-1234', note: 'left arm' });
  check('administer: batch goes into the note', r.ok && r.plan.note === 'Batch/lot: AB-1234. left arm', r.ok ? String(r.plan.note) : '');
}
check('administer: batch only note', (() => {
  const r = run(pending, { action: 'ADMINISTERED', batchNumber: 'LOT9' });
  return r.ok && r.plan.note === 'Batch/lot: LOT9';
})());
check('administer: bad batch rejected', isErr(run(pending, { action: 'ADMINISTERED', batchNumber: '!!' }), 400));
check('administer: no note and no batch -> null note', (() => {
  const r = run(pending, { action: 'ADMINISTERED' });
  return r.ok && r.plan.note === null;
})());

// ---------- POSTPONED ----------
{
  const r = run(pending, { action: 'POSTPONED', newDueDate: '2026-11-30', note: 'child has fever' });
  check('postpone: moves the due date', r.ok && r.plan.dueDate === '2026-11-30' && r.plan.toStatus === 'POSTPONED');
}
check('postpone: needs a reason', isErr(run(pending, { action: 'POSTPONED', newDueDate: '2026-11-30' }), 400));
check('postpone: blank reason rejected', isErr(run(pending, { action: 'POSTPONED', newDueDate: '2026-11-30', note: '   ' }), 400));
check('postpone: needs a date', isErr(run(pending, { action: 'POSTPONED', note: 'x' }), 400));
check('postpone: today is rejected', isErr(run(pending, { action: 'POSTPONED', newDueDate: TODAY, note: 'x' }), 400));
check('postpone: past is rejected', isErr(run(pending, { action: 'POSTPONED', newDueDate: '2026-11-01', note: 'x' }), 400));
check('postpone: tomorrow is allowed', run(pending, { action: 'POSTPONED', newDueDate: '2026-11-23', note: 'x' }).ok);
check('postpone: exactly the maximum is allowed', run(pending, { action: 'POSTPONED', newDueDate: '2027-11-22', note: 'x' }).ok);
check('postpone: beyond the maximum rejected', isErr(run(pending, { action: 'POSTPONED', newDueDate: '2027-11-23', note: 'x' }), 400));
check('postpone: MAX_POSTPONE_DAYS is 365', MAX_POSTPONE_DAYS === 365);
check('postpone: given dose cannot be postponed', isErr(run(given, { action: 'POSTPONED', newDueDate: '2026-11-30', note: 'x' }), 409));
check('postpone: not-given dose must be reopened first', isErr(run(notGiven, { action: 'POSTPONED', newDueDate: '2026-11-30', note: 'x' }), 409));
check('postpone: same date as current -> 409', isErr(run(postponed, { action: 'POSTPONED', newDueDate: '2026-12-01', note: 'x' }), 409));
check('postpone: an already-postponed dose can move again', run(postponed, { action: 'POSTPONED', newDueDate: '2026-12-15', note: 'x' }).ok);

// ---------- NOT_GIVEN ----------
{
  const r = run(pending, { action: 'NOT_GIVEN', note: 'parent declined' });
  check('not given: recorded with reason', r.ok && r.plan.toStatus === 'NOT_GIVEN' && r.plan.note === 'parent declined');
  check('not given: due date unchanged', r.ok && r.plan.dueDate === '2026-11-20');
}
check('not given: needs a reason', isErr(run(pending, { action: 'NOT_GIVEN' }), 400));
check('not given: given dose -> 409', isErr(run(given, { action: 'NOT_GIVEN', note: 'x' }), 409));
check('not given: already not given -> 409', isErr(run(notGiven, { action: 'NOT_GIVEN', note: 'x' }), 409));
check('not given: from POSTPONED allowed', run(postponed, { action: 'NOT_GIVEN', note: 'x' }).ok);

// ---------- PENDING (reopen / correction) ----------
{
  const r = run(given, { action: 'PENDING', note: 'entered for the wrong child' });
  check('reopen: given dose can be corrected', r.ok && r.plan.toStatus === 'PENDING');
  check('reopen: clears the administration details', r.ok && r.plan.clearAdministration && r.plan.administeredOn === null);
}
check('reopen: needs a note', isErr(run(given, { action: 'PENDING' }), 400));
check('reopen: not-given can be reopened', run(notGiven, { action: 'PENDING', note: 'parent agreed now' }).ok);
check('reopen: pending -> 409', isErr(run(pending, { action: 'PENDING', note: 'x' }), 409));
check('reopen: postponed -> 409', isErr(run(postponed, { action: 'PENDING', note: 'x' }), 409));

// ---------- misc ----------
check('unknown action rejected', isErr(run(pending, { action: 'EXPLODE' as never }), 400));
check('notes are trimmed and whitespace collapsed', (() => {
  const r = run(pending, { action: 'NOT_GIVEN', note: '  child   unwell  ' });
  return r.ok && r.plan.note === 'child unwell';
})());
check('buildDoseNote: nothing -> null', buildDoseNote(null, null) === null);
check('batch pattern accepts normal lots', BATCH_PATTERN.test('BCG-2026/11') && BATCH_PATTERN.test('A1'));
check('batch pattern rejects one character and symbols', !BATCH_PATTERN.test('A') && !BATCH_PATTERN.test('A B') && !BATCH_PATTERN.test('x;drop'));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
