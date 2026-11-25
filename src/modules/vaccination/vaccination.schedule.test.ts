/**
 * Run with:  npx tsx src/modules/vaccination/vaccination.schedule.test.ts
 * (No test framework is set up in the project yet; this is a plain script that
 * exits non-zero on any failure.)
 */
import {
  addDays, addMonths, addYears, daysBetween, isValidYmd, istDateTime, todayInIst,
} from './vaccination.dates';
import { deriveDoseStatus, generateChildDoses } from './vaccination.schedule';
import type { ChildScheduleAttributes, ScheduleEntryInput } from './vaccination.schedule';
import { UIP_SCHEDULE, UIP_VACCINES } from './uipSchedule.data';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);

// Schedule entries as they would come from the database
const nameByCode = new Map(UIP_VACCINES.map((v) => [v.code, v.name]));
const ENTRIES: ScheduleEntryInput[] = UIP_SCHEDULE.map((e, i) => ({
  id: `entry-${i + 1}`,
  vaccineName: nameByCode.get(e.vaccineCode)!,
  sortOrder: i + 1,
  ...e,
}));
const child = (dob: string, over: Partial<ChildScheduleAttributes> = {}): ChildScheduleAttributes => ({
  dateOfBirth: dob, gender: 'MALE', jeEndemicArea: false, ...over,
});
const dueOf = (doses: { doseLabel: string; dueDate: string }[], label: string) =>
  doses.find((d) => d.doseLabel === label)?.dueDate;

const TODAY = '2026-11-15';

// ---------- calendar arithmetic ----------
check('addMonths clamps to month end (31 Aug + 6m = 28 Feb)', addMonths('2026-08-31', 6) === '2027-02-28');
check('addMonths handles leap years (31 Aug + 6m = 29 Feb 2028)', addMonths('2027-08-31', 6) === '2028-02-29');
check('addYears: 29 Feb + 1y = 28 Feb', addYears('2028-02-29', 1) === '2029-02-28');
check('addDays crosses year end', addDays('2026-12-31', 1) === '2027-01-01');
check('isValidYmd rejects 30 Feb', !isValidYmd('2026-02-30'));
check('isValidYmd rejects non-padded input', !isValidYmd('2026-2-3'));
check('isValidYmd accepts a real leap day', isValidYmd('2028-02-29'));
check('daysBetween', daysBetween('2026-11-13', '2026-11-16') === 3);

// ---------- India time ----------
check('IST: 19:00 UTC is already the next day in India', todayInIst(new Date('2026-11-14T19:00:00Z')) === '2026-11-15');
check('IST: 18:29 UTC is still the same day', todayInIst(new Date('2026-11-14T18:29:59Z')) === '2026-11-14');
check('IST: 18:30 UTC is midnight in India', todayInIst(new Date('2026-11-14T18:30:00Z')) === '2026-11-15');
check('09:00 IST is 03:30 UTC', istDateTime('2026-11-13', 9).toISOString() === '2026-11-13T03:30:00.000Z');

// The four reminder days from the spec's example (due 15 November)
check('reminder days for a 15 Nov dose are 13, 14, 15, 16 Nov',
  [-2, -1, 0, 1].map((n) => addDays('2026-11-15', n)).join() === '2026-11-13,2026-11-14,2026-11-15,2026-11-16');

// ---------- seed data integrity ----------
const codes = new Set(UIP_VACCINES.map((v) => v.code));
check('every schedule entry refers to a known vaccine', UIP_SCHEDULE.every((e) => codes.has(e.vaccineCode)));
check('no duplicate (vaccine, dose number)',
  new Set(UIP_SCHEDULE.map((e) => `${e.vaccineCode}#${e.doseNumber}`)).size === UIP_SCHEDULE.length);
check('26 schedule entries, 2 of them JE-only',
  UIP_SCHEDULE.length === 26 && UIP_SCHEDULE.filter((e) => e.applicability === 'JE_ENDEMIC_DISTRICT').length === 2);

// ---------- schedule generation ----------
const a = generateChildDoses(child('2026-01-15'), ENTRIES, [], TODAY);
check('no validation errors for a normal child', a.errors.length === 0, a.errors.join('; '));
check('24 doses when not in a JE-endemic district', a.doses.length === 24);
check('no JE doses when not endemic', !a.doses.some((d) => d.vaccineCode === 'JE'));
check('26 doses when in a JE-endemic district',
  generateChildDoses(child('2026-01-15', { jeEndemicArea: true }), ENTRIES, [], TODAY).doses.length === 26);

check('BCG due on the date of birth', dueOf(a.doses, 'BCG') === '2026-01-15');
check('6 weeks = +42 days', dueOf(a.doses, 'Pentavalent-1') === '2026-02-26');
check('10 weeks = +70 days', dueOf(a.doses, 'Pentavalent-2') === '2026-03-26');
check('14 weeks = +98 days', dueOf(a.doses, 'Pentavalent-3') === '2026-04-23');
check('MR-1 at 9 months', dueOf(a.doses, 'MR-1') === '2026-10-15');
check('MR-2 at 16 months', dueOf(a.doses, 'MR-2') === '2027-05-15');
check('DPT Booster-2 at 5 years', dueOf(a.doses, 'DPT Booster-2') === '2031-01-15');
check('Td at 10 and 16 years',
  dueOf(a.doses, 'Td (10 years)') === '2036-01-15' && dueOf(a.doses, 'Td (16 years)') === '2042-01-15');
check('9 months for a 31 May birth clamps to 28 Feb',
  dueOf(generateChildDoses(child('2026-05-31'), ENTRIES, [], TODAY).doses, 'MR-1') === '2027-02-28');
check('doses are in due-date order',
  a.doses.every((d, i) => {
  const previous = a.doses[i - 1];
  return i === 0 || (previous !== undefined && previous.dueDate <= d.dueDate);
}));
check('originalDueDate equals dueDate at creation', a.doses.every((d) => d.originalDueDate === d.dueDate));
check('all doses start PENDING with no history', a.doses.every((d) => d.recordedStatus === 'PENDING'));

// ---------- existing vaccination history ----------
const h = generateChildDoses(
  child('2026-09-01'), ENTRIES,
  [
    { vaccineCode: 'BCG', doseNumber: 1, administeredOn: '2026-09-02' },
    { vaccineCode: 'HEPB', doseNumber: 1, administeredOn: '2026-09-01' },
    { vaccineCode: 'OPV', doseNumber: 1, administeredOn: '2026-09-01' },
  ],
  TODAY
);
check('history accepted without errors', h.errors.length === 0, h.errors.join('; '));
check('historical doses come back ADMINISTERED with their dates',
  h.doses.filter((d) => d.recordedStatus === 'ADMINISTERED').length === 3 &&
  h.doses.find((d) => d.vaccineCode === 'BCG')?.administeredOn === '2026-09-02');
check('historical doses are flagged as historical', h.doses.filter((d) => d.isHistorical).length === 3);
check('doses not in the history stay PENDING', h.doses.filter((d) => d.recordedStatus === 'PENDING').length === 21);

const bad = generateChildDoses(
  child('2026-09-01'), ENTRIES,
  [
    { vaccineCode: 'BCG', doseNumber: 1, administeredOn: '2026-08-31' },   // before birth
    { vaccineCode: 'HEPB', doseNumber: 1, administeredOn: '2026-12-01' },  // future
    { vaccineCode: 'XYZ', doseNumber: 1, administeredOn: '2026-09-02' },   // unknown vaccine
    { vaccineCode: 'JE', doseNumber: 1, administeredOn: '2026-11-01' },    // not applicable (not endemic)
    { vaccineCode: 'OPV', doseNumber: 1, administeredOn: '2026-13-01' },   // invalid date
    { vaccineCode: 'OPV', doseNumber: 2, administeredOn: '2026-10-20' },
    { vaccineCode: 'OPV', doseNumber: 2, administeredOn: '2026-10-21' },   // duplicate
  ],
  TODAY
);
check('every bad history row is reported (6 errors)', bad.errors.length === 6, bad.errors.join(' | '));
check('error messages are specific',
  bad.errors.some((e) => /before the date of birth/.test(e)) &&
  bad.errors.some((e) => /future/.test(e)) &&
  bad.errors.some((e) => /not part of this child's schedule/.test(e)) &&
  bad.errors.some((e) => /more than once/.test(e)));
check('JE history is accepted for a JE-endemic child',
  generateChildDoses(child('2026-01-01', { jeEndemicArea: true }), ENTRIES,
    [{ vaccineCode: 'JE', doseNumber: 1, administeredOn: '2026-10-05' }], TODAY).errors.length === 0);

// ---------- children registered after birth ----------
const late = generateChildDoses(
  child('2023-11-15'), ENTRIES,
  [{ vaccineCode: 'MR', doseNumber: 1, administeredOn: '2024-08-20' }],
  TODAY
);
const statusOf = (label: string) => {
  const d = late.doses.find((x) => x.doseLabel === label)!;
  return deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate: d.dueDate }, TODAY);
};
check('late registration: missed birth dose is OVERDUE', statusOf('BCG') === 'OVERDUE');
check('late registration: recorded MR-1 is ADMINISTERED', statusOf('MR-1') === 'ADMINISTERED');
check('late registration: MR-2 (16 months) is OVERDUE', statusOf('MR-2') === 'OVERDUE');
check('late registration: DPT Booster-2 (5 years) is UPCOMING', statusOf('DPT Booster-2') === 'UPCOMING');

const born = generateChildDoses(child(TODAY), ENTRIES, [], TODAY);
const bornStatuses = born.doses.map((d) => deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate: d.dueDate }, TODAY));
check('newborn registered today: 3 birth doses are DUE', bornStatuses.filter((s) => s === 'DUE').length === 3);
check('newborn registered today: everything else UPCOMING', bornStatuses.filter((s) => s === 'UPCOMING').length === 21);

// ---------- status derivation ----------
const st = (recordedStatus: any, dueDate: string) => deriveDoseStatus({ recordedStatus, dueDate }, TODAY);
check('PENDING in the future is UPCOMING', st('PENDING', '2026-11-16') === 'UPCOMING');
check('PENDING due today is DUE', st('PENDING', '2026-11-15') === 'DUE');
check('PENDING in the past is OVERDUE', st('PENDING', '2026-11-14') === 'OVERDUE');
check('ADMINISTERED stays ADMINISTERED whatever the date', st('ADMINISTERED', '2020-01-01') === 'ADMINISTERED');
check('NOT_GIVEN stays NOT_GIVEN', st('NOT_GIVEN', '2020-01-01') === 'NOT_GIVEN');
check('POSTPONED to a future date shows POSTPONED', st('POSTPONED', '2026-12-01') === 'POSTPONED');
check('POSTPONED date arrives -> DUE', st('POSTPONED', '2026-11-15') === 'DUE');
check('POSTPONED date passed -> OVERDUE', st('POSTPONED', '2026-11-10') === 'OVERDUE');

// ---------- date-of-birth validation ----------
check('future date of birth is rejected',
  generateChildDoses(child('2026-11-16'), ENTRIES, [], TODAY).errors.some((e) => /future/.test(e)));
check('date of birth more than 18 years ago is rejected',
  generateChildDoses(child('2008-01-01'), ENTRIES, [], TODAY).errors.some((e) => /18 years/.test(e)));
check('a child exactly 18 years old today is accepted',
  generateChildDoses(child('2008-11-15'), ENTRIES, [], TODAY).errors.length === 0);
const invalid = generateChildDoses(child('2026-02-30'), ENTRIES, [], TODAY);
check('an impossible date returns no doses and an error', invalid.doses.length === 0 && invalid.errors.length === 1);

// ---------- applicability rules ----------
const hpv: ScheduleEntryInput = {
  id: 'hpv', vaccineCode: 'HPV', vaccineName: 'HPV', doseNumber: 1, doseLabel: 'HPV',
  ageValue: 14, ageUnit: 'YEARS', ageLabel: '14 years', applicability: 'FEMALE_ONLY',
};
const hasHpv = (g: ChildScheduleAttributes['gender']) =>
  generateChildDoses(child('2012-06-01', { gender: g }), [hpv], [], TODAY).doses.length === 1;
check('FEMALE_ONLY rule applies to girls only', hasHpv('FEMALE') && !hasHpv('MALE') && !hasHpv('OTHER'));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
