/**
 * Run with:  npx tsx src/modules/vaccination/dose.view.test.ts
 */
import { describeAge, isOpenStatus } from './dose.view';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);
const age = (dob: string, today: string) => describeAge(dob, today);

check('born today', age('2026-11-22', '2026-11-22') === '0 days', age('2026-11-22', '2026-11-22'));
check('one day old', age('2026-11-21', '2026-11-22') === '1 day');
check('12 days', age('2026-11-10', '2026-11-22') === '12 days');
check('29 days is still days (Feb)', age('2026-01-31', '2026-02-28') === '28 days', age('2026-01-31', '2026-02-28'));
check('exactly 1 month', age('2026-10-22', '2026-11-22') === '1 month');
check('one day short of a month', age('2026-10-23', '2026-11-22') === '30 days', age('2026-10-23', '2026-11-22'));
check('7 months', age('2026-04-10', '2026-11-22') === '7 months');
check('23 months', age('2024-12-22', '2026-11-22') === '23 months', age('2024-12-22', '2026-11-22'));
check('24 months becomes years', age('2024-11-22', '2026-11-22') === '2 years', age('2024-11-22', '2026-11-22'));
check('3 years 2 months', age('2023-09-10', '2026-11-22') === '3 years 2 months', age('2023-09-10', '2026-11-22'));
check('3 years 1 month (singular)', age('2023-10-10', '2026-11-22') === '3 years 1 month', age('2023-10-10', '2026-11-22'));
check('month-end birthday (31st) before the 28th', age('2026-08-31', '2026-11-30') === '2 months', age('2026-08-31', '2026-11-30'));
check('leap-day birth', age('2024-02-29', '2026-03-01') === '2 years', age('2024-02-29', '2026-03-01'));
check('future dob -> empty', age('2026-12-01', '2026-11-22') === '');
check('invalid dob -> empty', age('2026-02-30', '2026-11-22') === '');

check('open statuses', isOpenStatus('OVERDUE') && isOpenStatus('DUE') && isOpenStatus('UPCOMING') && isOpenStatus('POSTPONED'));
check('closed statuses', !isOpenStatus('ADMINISTERED') && !isOpenStatus('NOT_GIVEN'));

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
