/**
 * Run with:  npx tsx src/modules/vaccination/reminder.test.ts
 */
import {
  planReminders, isTooLate, retryDelayMs, reconcileWindow, planReconcile, invalidReason, groupKey,
  decideAfterAttempt, MAX_ATTEMPTS, MAX_LATE_MS,
} from './reminder.schedule';
import type { ExistingReminder, OpenDose } from './reminder.schedule';
import { buildSmsText, buildNotification, formatDmy, joinNames, templateKey } from './reminder.templates';
import { MockSmsProvider, maskPhone, toE164India, getSmsProvider } from './sms.provider';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);

// 09:00 IST is 03:30 UTC
const at = (ymd: string, hhmmUtc: string) => new Date(`${ymd}T${hhmmUtc}:00.000Z`);

// ---------- planReminders ----------
{
  const p = planReminders('2026-12-10');
  check('four reminders', p.length === 4);
  check('kinds in order', p.map((r) => r.kind).join() === 'TWO_DAYS_BEFORE,ONE_DAY_BEFORE,ON_DUE_DATE,ONE_DAY_AFTER');
  check('target days are -2, -1, 0, +1',
    p.map((r) => r.targetDate).join() === '2026-12-08,2026-12-09,2026-12-10,2026-12-11', p.map((r) => r.targetDate).join());
  check('sent at 09:00 IST = 03:30 UTC', p.every((r) => r.scheduledFor.toISOString().slice(11, 16) === '03:30'));
  check('on-due-date instant', p[2]!.scheduledFor.toISOString() === '2026-12-10T03:30:00.000Z');
}
check('month boundary: due 1 Mar (non-leap) -> 2 days before is 27 Feb', planReminders('2026-03-01')[0]!.targetDate === '2026-02-27');
check('leap year: due 1 Mar 2028 -> 2 days before is 28 Feb', planReminders('2028-03-01')[0]!.targetDate === '2028-02-28');
check('year boundary: due 31 Dec -> day after is 1 Jan', planReminders('2026-12-31')[3]!.targetDate === '2027-01-01');

// ---------- late / retry / window ----------
{
  const s = at('2026-12-10', '03:30');
  check('not late at the scheduled time', !isTooLate(s, s));
  check('not late 12 hours after', !isTooLate(s, new Date(s.getTime() + MAX_LATE_MS)));
  check('late 12 hours and 1 ms after', isTooLate(s, new Date(s.getTime() + MAX_LATE_MS + 1)));
  check('not late before the time', !isTooLate(s, new Date(s.getTime() - 3_600_000)));
}
check('retry after attempt 1 is 15 minutes', retryDelayMs(1) === 15 * 60_000);
check('retry after attempt 2 is 60 minutes', retryDelayMs(2) === 60 * 60_000);
check('window around today', JSON.stringify(reconcileWindow('2026-11-22')) === '{"from":"2026-11-21","to":"2026-11-24"}');

// ---------- planReconcile ----------
const NOW = at('2026-12-10', '04:00'); // 09:30 IST on 10 Dec
const dose = (id: string, dueDate: string): OpenDose => ({ doseId: id, childId: 'c1', dueDate });
{
  const r = planReconcile([dose('d1', '2026-12-10')], [], NOW);
  // due today at 09:30: the 2-days-before and 1-day-before times are long past, 'on due date' (09:00, 30 min ago) and tomorrow's remain
  check('due today: creates on-due-date and day-after only',
    r.create.map((c) => c.kind).join() === 'ON_DUE_DATE,ONE_DAY_AFTER', r.create.map((c) => c.kind).join());
  check('nothing to revive', r.revive.length === 0);
  check('created rows carry the snapshot date', r.create.every((c) => c.dueDateSnapshot === '2026-12-10' && c.childId === 'c1'));
}
{
  const r = planReconcile([dose('d1', '2026-12-12')], [], NOW);
  check('due in 2 days: creates all four', r.create.length === 4);
}
{
  const existing: ExistingReminder[] = [
    { id: 'r1', doseId: 'd1', kind: 'ON_DUE_DATE', dueDateSnapshot: '2026-12-10', status: 'SENT' },
    { id: 'r2', doseId: 'd1', kind: 'ONE_DAY_AFTER', dueDateSnapshot: '2026-12-10', status: 'PENDING' },
  ];
  const r = planReconcile([dose('d1', '2026-12-10')], existing, NOW);
  check('idempotent: nothing created twice', r.create.length === 0 && r.revive.length === 0);
}
{
  const existing: ExistingReminder[] = [
    { id: 'r9', doseId: 'd1', kind: 'ONE_DAY_AFTER', dueDateSnapshot: '2026-12-10', status: 'CANCELLED' },
  ];
  const r = planReconcile([dose('d1', '2026-12-10')], existing, NOW);
  check('a cancelled reminder for the current due date is revived', r.revive.join() === 'r9');
  check('and the missing on-due-date one is created', r.create.map((c) => c.kind).join() === 'ON_DUE_DATE');
}
{
  const existing: ExistingReminder[] = [
    { id: 'r5', doseId: 'd1', kind: 'ONE_DAY_AFTER', dueDateSnapshot: '2026-12-01', status: 'SENT' },
  ];
  const r = planReconcile([dose('d1', '2026-12-12')], existing, NOW);
  check('a postponed dose gets a fresh set for the new date', r.create.length === 4);
}
check('failed reminders are not recreated', planReconcile(
  [dose('d1', '2026-12-10')],
  [{ id: 'r', doseId: 'd1', kind: 'ON_DUE_DATE', dueDateSnapshot: '2026-12-10', status: 'FAILED' }],
  NOW
).create.map((c) => c.kind).join() === 'ONE_DAY_AFTER');

// ---------- invalidReason / groupKey / decideAfterAttempt ----------
check('valid for an open dose', invalidReason('2026-12-10', { recordedStatus: 'PENDING', dueDate: '2026-12-10' }) === null);
check('valid for a postponed dose with the same date', invalidReason('2026-12-10', { recordedStatus: 'POSTPONED', dueDate: '2026-12-10' }) === null);
check('invalid once given', invalidReason('2026-12-10', { recordedStatus: 'ADMINISTERED', dueDate: '2026-12-10' }) === 'Dose already given');
check('invalid when not given', invalidReason('2026-12-10', { recordedStatus: 'NOT_GIVEN', dueDate: '2026-12-10' }) === 'Dose marked as not given');
check('invalid when the due date moved', invalidReason('2026-12-10', { recordedStatus: 'POSTPONED', dueDate: '2026-12-20' }) === 'Due date changed');
check('group key joins child, kind and due date', groupKey({ childId: 'c', kind: 'ON_DUE_DATE', dueDateSnapshot: '2026-12-10' }) === 'c|ON_DUE_DATE|2026-12-10');

{
  const now = new Date('2026-12-10T04:00:00.000Z');
  check('success -> SENT', decideAfterAttempt(1, true, now).status === 'SENT');
  const f1 = decideAfterAttempt(1, false, now);
  check('first failure -> retry in 15 min', f1.status === 'PENDING' && f1.nextAttemptAt.getTime() === now.getTime() + 15 * 60_000);
  const f2 = decideAfterAttempt(2, false, now);
  check('second failure -> retry in 60 min', f2.status === 'PENDING' && f2.nextAttemptAt.getTime() === now.getTime() + 60 * 60_000);
  check('last allowed attempt failing -> FAILED', decideAfterAttempt(MAX_ATTEMPTS, false, now).status === 'FAILED');
  check('success on the last attempt is still SENT', decideAfterAttempt(MAX_ATTEMPTS, true, now).status === 'SENT');
  check('MAX_ATTEMPTS is 3', MAX_ATTEMPTS === 3);
}

// ---------- templates ----------
check('dmy format', formatDmy('2026-11-22') === '22-11-2026');
check('join one', joinNames(['BCG'], 'EN') === 'BCG');
check('join two', joinNames(['BCG', 'OPV'], 'EN') === 'BCG and OPV');
check('join three', joinNames(['BCG', 'OPV', 'HEPB'], 'EN') === 'BCG, OPV and HEPB');
check('join three in Hindi', joinNames(['BCG', 'OPV', 'HEPB'], 'HI') === 'BCG, OPV और HEPB');
check('join none', joinNames([], 'EN') === '');
{
  const base = { childName: 'Aarav', vaccineNames: ['MR'], dueDate: '2026-12-10' } as const;
  const en = (kind: Parameters<typeof buildSmsText>[0]['kind']) => buildSmsText({ ...base, vaccineNames: [...base.vaccineNames], kind, lang: 'EN' });
  const hi = (kind: Parameters<typeof buildSmsText>[0]['kind']) => buildSmsText({ ...base, vaccineNames: [...base.vaccineNames], kind, lang: 'HI' });
  check('EN two days before', en('TWO_DAYS_BEFORE').includes("Aarav's MR vaccine is due on 10-12-2026"), en('TWO_DAYS_BEFORE'));
  check('EN one day before says tomorrow', en('ONE_DAY_BEFORE').includes('due tomorrow'));
  check('EN on the day says today', en('ON_DUE_DATE').includes('due today'));
  check('EN day after says was due', en('ONE_DAY_AFTER').includes('was due on 10-12-2026'));
  check('HI messages are Devanagari and carry name, vaccine and date',
    ['TWO_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'ON_DUE_DATE', 'ONE_DAY_AFTER'].every((k) => {
      const t = hi(k as never);
      return /[ऀ-ॿ]/.test(t) && t.includes('Aarav') && t.includes('MR') && t.includes('10-12-2026');
    }));
  check('all eight texts are different', new Set([...['TWO_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'ON_DUE_DATE', 'ONE_DAY_AFTER'].flatMap((k) => [en(k as never), hi(k as never)])]).size === 8);
  check('no message tells the parent anything medical', ['TWO_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'ON_DUE_DATE', 'ONE_DAY_AFTER'].every((k) => !/diagnos|treat|dose of|mg|side effect/i.test(en(k as never))));
}
check('multi-vaccine message', buildSmsText({ kind: 'ON_DUE_DATE', lang: 'EN', childName: 'Aarav', vaccineNames: ['OPV', 'Pentavalent'], dueDate: '2026-12-10' }).includes('OPV and Pentavalent vaccine'));
{
  const n = buildNotification({ kind: 'ONE_DAY_AFTER', childName: 'Aarav', vaccineNames: ['MR'], dueDate: '2026-12-10' });
  check('notification title for overdue', n.title === 'Vaccination overdue');
  check('notification body', n.body === 'Aarav: MR (due 10-12-2026)', n.body);
}
check('template key', templateKey('ON_DUE_DATE', 'HI') === 'vaccine_reminder_on_due_date_hi');

// ---------- SMS provider ----------
check('mask phone', maskPhone('9876543210') === '******3210');
check('mask phone with +91', maskPhone('+919876543210') === '******3210');
check('mask short value', maskPhone('12') === '****');
check('E.164', toE164India('9876543210') === '+919876543210');

(async () => {
  const mock = new MockSmsProvider(false);
  const origLog = console.log;
  const logged: string[] = [];
  console.log = (...a: unknown[]) => { logged.push(a.join(' ')); };
  const ok = await mock.send({ to: '+919876543210', text: 'secret text', templateKey: 't' });
  let failed = false;
  try { await mock.send({ to: '+919876540000', text: 'x', templateKey: 't' }); } catch { failed = true; }
  console.log = origLog;

  check('mock send returns an id', ok.providerMessageId.startsWith('mock-'));
  check('mock logs only the masked number', logged.length === 1 && logged[0]!.includes('******3210') && !logged[0]!.includes('9876543210'));
  check('mock hides the text when text logging is off', !logged[0]!.includes('secret text'));
  check('mock fails for numbers ending 0000', failed);
  check('default provider is the mock', getSmsProvider().name === 'mock');

  console.log(results.join('\n'));
  const bad = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - bad}/${results.length} passed`);
  process.exit(bad ? 1 : 0);
})();
