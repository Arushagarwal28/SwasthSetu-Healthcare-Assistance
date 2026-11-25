/**
 * Run with:  npx tsx src/modules/vaccination/child.utils.test.ts
 * Plain script (no test framework in the project); exits non-zero on any failure.
 */
import {
  INDIAN_MOBILE, PIN_CODE, normalizeIndianMobile, cleanText, formatRecordNumber,
  toYmd, ymdToDate, duplicateReasons,
} from './child.utils';

const results: string[] = [];
const check = (name: string, ok: boolean, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);

// ---------- mobile numbers ----------
check('plain 10-digit number is unchanged', normalizeIndianMobile('9876543210') === '9876543210');
check('+91 prefix and spaces are removed', normalizeIndianMobile('+91 98765 43210') === '9876543210');
check('91 prefix is removed', normalizeIndianMobile('919876543210') === '9876543210');
check('leading 0 is removed', normalizeIndianMobile('09876543210') === '9876543210');
check('dashes are removed', normalizeIndianMobile('98765-43210') === '9876543210');
check('a 10-digit number that starts with 91 is NOT stripped', normalizeIndianMobile('9198765432') === '9198765432');
check('valid mobile accepted', INDIAN_MOBILE.test('9876543210'));
check('mobile starting with 5 rejected', !INDIAN_MOBILE.test('5876543210'));
check('9-digit mobile rejected', !INDIAN_MOBILE.test('987654321'));
check('11-digit mobile rejected', !INDIAN_MOBILE.test('98765432101'));

// ---------- PIN codes ----------
check('valid PIN accepted', PIN_CODE.test('110001'));
check('PIN starting with 0 rejected', !PIN_CODE.test('010001'));
check('5-digit PIN rejected', !PIN_CODE.test('11000'));
check('7-digit PIN rejected', !PIN_CODE.test('1100011'));

// ---------- text and ids ----------
check('cleanText collapses spaces', cleanText('  Ram   Kumar ') === 'Ram Kumar');
check('cleanText: blank becomes null', cleanText('   ') === null);
check('cleanText: non-string becomes null', cleanText(5) === null);
check('record number is zero-padded', formatRecordNumber(123) === 'SSV-000123');
check('date round trip', toYmd(ymdToDate('2026-02-28')) === '2026-02-28');
check('ymdToDate is UTC midnight', ymdToDate('2026-11-19').toISOString() === '2026-11-19T00:00:00.000Z');

// ---------- duplicate detection (all candidates already share the DOB) ----------
const existing = {
  fullName: 'Aarav Sharma',
  motherName: 'Sunita Sharma',
  fatherName: 'Rakesh Sharma',
  primaryMobile: '9876543210',
  alternateMobile: '9123456789',
};
const probe = (over: Partial<{ fullName: string; motherName: string; fatherName: string; mobiles: string[] }>) => ({
  fullName: 'Different Child',
  motherName: 'Other Mother',
  fatherName: 'Other Father',
  mobiles: ['9000000001'],
  ...over,
});

check('no overlap -> no reasons', duplicateReasons(existing, probe({})).length === 0);
check('same primary mobile', duplicateReasons(existing, probe({ mobiles: ['9876543210'] })).join() === 'SAME_MOBILE');
check('same alternate mobile', duplicateReasons(existing, probe({ mobiles: ['9123456789'] })).join() === 'SAME_MOBILE');
check('same mother, case and spacing ignored',
  duplicateReasons(existing, probe({ motherName: '  SUNITA   sharma ' })).join() === 'SAME_MOTHER');
check('same father', duplicateReasons(existing, probe({ fatherName: 'rakesh sharma' })).join() === 'SAME_FATHER');
check('same child name', duplicateReasons(existing, probe({ fullName: 'aarav sharma' })).join() === 'SAME_CHILD_NAME');
check('twins (everything the same) report all four reasons',
  duplicateReasons(existing, {
    fullName: 'Aarav Sharma', motherName: 'Sunita Sharma', fatherName: 'Rakesh Sharma', mobiles: ['9876543210'],
  }).length === 4);

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
