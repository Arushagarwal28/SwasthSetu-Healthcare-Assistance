/**
 * Validation of vaccine-schedule edits made by an administrator. Pure
 * functions, tested in schedule.admin.rules.test.ts.
 *
 * Important property of the system: editing the schedule changes what NEW
 * children get. Children already registered keep the doses and dates they were given.
 */
import { addAge, addYears } from './vaccination.dates';
import type { AgeUnit } from './vaccination.dates';
import type { ApplicabilityRule } from './vaccination.schedule';

export const VACCINE_CODE = /^[A-Z][A-Z0-9_-]{1,19}$/;
export const AGE_UNITS: AgeUnit[] = ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'];
export const APPLICABILITY_RULES: ApplicabilityRule[] = ['ALWAYS', 'JE_ENDEMIC_DISTRICT', 'FEMALE_ONLY'];

/** The schedule covers children up to this age; a dose due later could never be generated. */
export const MAX_SCHEDULE_AGE_YEARS = 18;

// Any fixed date works: only the difference between two ages matters.
const REFERENCE_DOB = '2000-01-01';
const dueOffset = (value: number, unit: AgeUnit): string => addAge(REFERENCE_DOB, value, unit);

export const validateAge = (ageValue: number, ageUnit: AgeUnit): string | null => {
  if (!Number.isInteger(ageValue) || ageValue < 0) return 'ageValue must be a whole number, 0 or more';
  if (!AGE_UNITS.includes(ageUnit)) return `ageUnit must be one of ${AGE_UNITS.join(', ')}`;
  if (dueOffset(ageValue, ageUnit) > addYears(REFERENCE_DOB, MAX_SCHEDULE_AGE_YEARS)) {
    return `The dose would fall after the child's ${MAX_SCHEDULE_AGE_YEARS}th birthday`;
  }
  return null;
};

export interface EntryShape {
  doseNumber: number;
  ageValue: number;
  ageUnit: AgeUnit;
  isActive: boolean;
}

/**
 * Dose 2 may not be due before dose 1, dose 3 not before dose 2, and so on.
 * `candidate` replaces the existing entry with the same doseNumber (an edit), or is added (a new dose).
 */
export const validateDoseOrdering = (existing: EntryShape[], candidate: EntryShape): string | null => {
  if (!candidate.isActive) return null; // an inactive dose is not generated, so it cannot conflict
  const others = existing.filter((e) => e.isActive && e.doseNumber !== candidate.doseNumber);
  const all = [...others, candidate].sort((a, b) => a.doseNumber - b.doseNumber);

  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1]!;
    const cur = all[i]!;
    if (dueOffset(cur.ageValue, cur.ageUnit) < dueOffset(prev.ageValue, prev.ageUnit)) {
      return `Dose ${cur.doseNumber} cannot be due earlier than dose ${prev.doseNumber}`;
    }
  }
  return null;
};
