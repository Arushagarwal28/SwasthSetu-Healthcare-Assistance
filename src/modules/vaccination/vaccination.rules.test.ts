/**
 * Run with:  npx tsx src/modules/vaccination/vaccination.rules.test.ts
 * Covers centre search, schedule-edit validation and statistics maths.
 */
import { filterAndRank } from './centre.search';
import type { CentreRow } from './centre.search';
import { validateAge, validateDoseOrdering, VACCINE_CODE, MAX_SCHEDULE_AGE_YEARS } from './schedule.admin.rules';
import { coveragePercent, buildVaccineCoverage } from './statistics.rules';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);

// ---------- centres ----------
const centre = (id: string, name: string, over: Partial<CentreRow> = {}): CentreRow => ({
  id, name, type: 'PHC', address: `${name} road`, district: 'Lucknow', pinCode: '226001', phone: null,
  latitude: null, longitude: null, vaccines: [{ code: 'BCG', name: 'BCG', sessionInfo: null }], ...over,
});
const lucknow = { latitude: 26.8467, longitude: 80.9462 };
const kanpur = { latitude: 26.4499, longitude: 80.3319 }; // about 80 km away
const ROWS: CentreRow[] = [
  centre('a', 'Alambagh PHC', { ...lucknow, vaccines: [{ code: 'BCG', name: 'BCG', sessionInfo: 'Tue' }, { code: 'OPV', name: 'OPV', sessionInfo: null }] }),
  centre('b', 'Kanpur CHC', { ...kanpur, district: 'Kanpur Nagar', pinCode: '208001', vaccines: [{ code: 'MR', name: 'MR', sessionInfo: null }] }),
  centre('c', 'Unlocated clinic', { vaccines: [{ code: 'BCG', name: 'BCG', sessionInfo: null }, { code: 'MR', name: 'MR', sessionInfo: null }] }),
];

check('no filters: all, by name', filterAndRank(ROWS, {}).map((r) => r.id).join() === 'a,b,c');
check('district filter ignores case and spacing', filterAndRank(ROWS, { district: '  KANPUR   nagar ' }).map((r) => r.id).join() === 'b');
check('pin filter', filterAndRank(ROWS, { pinCode: '208001' }).map((r) => r.id).join() === 'b');
check('text search on name', filterAndRank(ROWS, { q: 'alam' }).map((r) => r.id).join() === 'a');
check('text search on address', filterAndRank(ROWS, { q: 'clinic road' }).map((r) => r.id).join() === 'c');
check('vaccine filter keeps only centres offering it', filterAndRank(ROWS, { vaccineCodes: ['MR'] }).map((r) => r.id).join() === 'b,c');
check('vaccine codes are case-insensitive', filterAndRank(ROWS, { vaccineCodes: ['mr'] }).length === 2);
check('centre offering more of the wanted vaccines ranks first',
  filterAndRank(ROWS, { vaccineCodes: ['BCG', 'MR'] }).map((r) => r.id).join() === 'c,a,b', filterAndRank(ROWS, { vaccineCodes: ['BCG', 'MR'] }).map((r) => r.id).join());
check('matched codes are reported', filterAndRank(ROWS, { vaccineCodes: ['BCG', 'OPV'] }).find((r) => r.id === 'a')!.matchedVaccineCodes.join() === 'BCG,OPV');
{
  const r = filterAndRank(ROWS, { lat: 26.85, lng: 80.95 });
  check('with a point: nearest first, unlocated last', r.map((x) => x.id).join() === 'a,b,c', r.map((x) => x.id).join());
  check('distance is filled in and plausible', r[0]!.distanceKm !== null && r[0]!.distanceKm < 2 && r[1]!.distanceKm! > 60 && r[1]!.distanceKm! < 100, `${r[0]!.distanceKm} / ${r[1]!.distanceKm}`);
  check('unlocated centre has no distance', r[2]!.distanceKm === null);
}
{
  const r = filterAndRank(ROWS, { lat: 26.85, lng: 80.95, radiusKm: 10 });
  check('radius drops far and unlocated centres', r.map((x) => x.id).join() === 'a', r.map((x) => x.id).join());
}
check('radius without a point is ignored', filterAndRank(ROWS, { radiusKm: 10 }).length === 3);
check('only a latitude is not a point', filterAndRank(ROWS, { lat: 26.85 }).every((r) => r.distanceKm === null));
check('combined district + vaccine', filterAndRank(ROWS, { district: 'Lucknow', vaccineCodes: ['MR'] }).map((r) => r.id).join() === 'c');
check('nothing matches -> empty', filterAndRank(ROWS, { vaccineCodes: ['JE'] }).length === 0);

// ---------- schedule edits ----------
check('age 0 days ok', validateAge(0, 'DAYS') === null);
check('age 6 weeks ok', validateAge(6, 'WEEKS') === null);
check('age 16 years ok', validateAge(16, 'YEARS') === null);
check('age 18 years is the limit and allowed', validateAge(MAX_SCHEDULE_AGE_YEARS, 'YEARS') === null);
check('age 19 years rejected', validateAge(19, 'YEARS') !== null);
check('age 217 months rejected (18y 1m)', validateAge(217, 'MONTHS') !== null);
check('age 216 months allowed (18y)', validateAge(216, 'MONTHS') === null);
check('negative age rejected', validateAge(-1, 'DAYS') !== null);
check('fractional age rejected', validateAge(1.5, 'MONTHS') !== null);
check('unknown unit rejected', validateAge(1, 'DECADES' as never) !== null);
check('vaccine code accepts BCG, HEPB, TD-2', ['BCG', 'HEPB', 'TD-2', 'OPV_2'].every((c) => VACCINE_CODE.test(c)));
check('vaccine code rejects lowercase, spaces, digits first, too short', ['bcg', 'B C', '1BCG', 'B', 'X'.repeat(21)].every((c) => !VACCINE_CODE.test(c)));

{
  const d1 = { doseNumber: 1, ageValue: 6, ageUnit: 'WEEKS' as const, isActive: true };
  const d2 = { doseNumber: 2, ageValue: 10, ageUnit: 'WEEKS' as const, isActive: true };
  const d3 = { doseNumber: 3, ageValue: 14, ageUnit: 'WEEKS' as const, isActive: true };
  check('ordering: valid new dose 4', validateDoseOrdering([d1, d2, d3], { doseNumber: 4, ageValue: 9, ageUnit: 'MONTHS', isActive: true }) === null);
  check('ordering: dose 4 before dose 3 rejected', validateDoseOrdering([d1, d2, d3], { doseNumber: 4, ageValue: 10, ageUnit: 'WEEKS', isActive: true }) !== null);
  check('ordering: same date as previous is allowed', validateDoseOrdering([d1, d2, d3], { doseNumber: 4, ageValue: 14, ageUnit: 'WEEKS', isActive: true }) === null);
  check('ordering: editing dose 2 to after dose 3 rejected', validateDoseOrdering([d1, d2, d3], { ...d2, ageValue: 4, ageUnit: 'MONTHS' }) !== null);
  check('ordering: editing dose 2 within bounds ok', validateDoseOrdering([d1, d2, d3], { ...d2, ageValue: 12, ageUnit: 'WEEKS' }) === null);
  check('ordering: mixed units compare correctly (3 months vs 14 weeks)', validateDoseOrdering([d1, d2, d3], { ...d3, ageValue: 2, ageUnit: 'MONTHS' }) !== null);
  check('ordering: editing dose 1 later than dose 2 rejected', validateDoseOrdering([d1, d2, d3], { ...d1, ageValue: 11, ageUnit: 'WEEKS' }) !== null);
  check('ordering: an inactive dose cannot conflict', validateDoseOrdering([d1, d2, d3], { doseNumber: 4, ageValue: 1, ageUnit: 'DAYS', isActive: false }) === null);
  check('ordering: inactive existing doses are ignored', validateDoseOrdering([d1, { ...d2, ageValue: 5, ageUnit: 'YEARS', isActive: false }, d3], { doseNumber: 4, ageValue: 15, ageUnit: 'WEEKS', isActive: true }) === null);
  check('ordering: first dose of a vaccine is always ok', validateDoseOrdering([], { doseNumber: 1, ageValue: 0, ageUnit: 'DAYS', isActive: true }) === null);
}

// ---------- statistics ----------
check('coverage 0/0 is 0', coveragePercent(0, 0, 0) === 0);
check('coverage 8 given, 2 overdue = 80', coveragePercent(8, 0, 2) === 80);
check('coverage counts not-given against it', coveragePercent(6, 2, 2) === 60);
check('coverage rounds to one decimal', coveragePercent(1, 0, 2) === 33.3);
check('coverage 100', coveragePercent(5, 0, 0) === 100);
{
  const rows = buildVaccineCoverage(
    [
      { vaccineCode: 'BCG', recordedStatus: 'ADMINISTERED', count: 9 },
      { vaccineCode: 'BCG', recordedStatus: 'PENDING', count: 50 },
      { vaccineCode: 'MR', recordedStatus: 'ADMINISTERED', count: 3 },
      { vaccineCode: 'MR', recordedStatus: 'NOT_GIVEN', count: 1 },
    ],
    [{ vaccineCode: 'BCG', count: 1 }, { vaccineCode: 'OPV', count: 4 }]
  );
  check('coverage rows sorted by code and include vaccines seen only in overdue', rows.map((r) => r.vaccineCode).join() === 'BCG,MR,OPV');
  check('future pending doses are not counted against BCG', rows[0]!.coveragePercent === 90 && rows[0]!.overdue === 1, JSON.stringify(rows[0]));
  check('MR: 3 given, 1 not given -> 75', rows[1]!.coveragePercent === 75);
  check('OPV: nothing given, 4 overdue -> 0', rows[2]!.coveragePercent === 0 && rows[2]!.overdue === 4);
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
