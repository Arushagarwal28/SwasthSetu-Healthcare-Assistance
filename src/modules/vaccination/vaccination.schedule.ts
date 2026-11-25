import { addAge, addYears, isValidYmd, todayInIst } from './vaccination.dates';
import type { AgeUnit } from './vaccination.dates';

export type ApplicabilityRule = 'ALWAYS' | 'JE_ENDEMIC_DISTRICT' | 'FEMALE_ONLY';
export type DoseRecordStatus = 'PENDING' | 'ADMINISTERED' | 'POSTPONED' | 'NOT_GIVEN';
export type EffectiveStatus =
  | 'UPCOMING'
  | 'DUE'
  | 'OVERDUE'
  | 'ADMINISTERED'
  | 'POSTPONED'
  | 'NOT_GIVEN';

/** The tracker covers children; the UIP schedule itself ends at 16 years. */
export const MAX_CHILD_AGE_YEARS = 18;

export interface ScheduleEntryInput {
  id: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  ageValue: number;
  ageUnit: AgeUnit;
  ageLabel: string;
  applicability: ApplicabilityRule;
  sortOrder?: number;
}

export interface ChildScheduleAttributes {
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  jeEndemicArea: boolean;
}

/** A dose the child already received before being registered. */
export interface HistoricalDose {
  vaccineCode: string;
  doseNumber: number;
  administeredOn: string; // YYYY-MM-DD
}

export interface GeneratedDose {
  scheduleEntryId: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  ageLabel: string;
  originalDueDate: string;
  dueDate: string;
  recordedStatus: 'PENDING' | 'ADMINISTERED';
  administeredOn: string | null;
  isHistorical: boolean;
}

const appliesTo = (rule: ApplicabilityRule, child: ChildScheduleAttributes): boolean =>
  rule === 'ALWAYS' ||
  (rule === 'JE_ENDEMIC_DISTRICT' && child.jeEndemicArea) ||
  (rule === 'FEMALE_ONLY' && child.gender === 'FEMALE');

const doseKey = (vaccineCode: string, doseNumber: number) => `${vaccineCode}#${doseNumber}`;

/**
 * Builds a child's dose list from the schedule. Pure function: no database, no
 * clock (pass `today`), so it is fully testable. Returns validation errors
 * instead of throwing so the API can report all of them at once.
 */
export const generateChildDoses = (
  child: ChildScheduleAttributes,
  entries: ScheduleEntryInput[],
  history: HistoricalDose[] = [],
  today: string = todayInIst()
): { doses: GeneratedDose[]; errors: string[] } => {
  const errors: string[] = [];

  if (!isValidYmd(child.dateOfBirth)) {
    return { doses: [], errors: ['Date of birth is not a valid date'] };
  }
  if (child.dateOfBirth > today) errors.push('Date of birth cannot be in the future');
  if (child.dateOfBirth < addYears(today, -MAX_CHILD_AGE_YEARS)) {
    errors.push(`Date of birth must be within the last ${MAX_CHILD_AGE_YEARS} years`);
  }

  const applicable = entries.filter((en) => appliesTo(en.applicability, child));
  const byKey = new Map(applicable.map((en) => [doseKey(en.vaccineCode, en.doseNumber), en]));

  // Validate the history the child arrives with
  const historyByKey = new Map<string, HistoricalDose>();
  for (const h of history) {
    const label = `${h.vaccineCode} dose ${h.doseNumber}`;
    const key = doseKey(h.vaccineCode, h.doseNumber);
    if (!byKey.has(key)) {
      errors.push(`${label} is not part of this child's schedule`);
      continue;
    }
    if (historyByKey.has(key)) {
      errors.push(`${label} is listed more than once`);
      continue;
    }
    if (!isValidYmd(h.administeredOn)) {
      errors.push(`${label}: administration date is not a valid date`);
      continue;
    }
    if (h.administeredOn < child.dateOfBirth) {
      errors.push(`${label}: cannot be given before the date of birth`);
      continue;
    }
    if (h.administeredOn > today) {
      errors.push(`${label}: administration date cannot be in the future`);
      continue;
    }
    historyByKey.set(key, h);
  }

  const doses: GeneratedDose[] = applicable.map((en) => {
    const due = addAge(child.dateOfBirth, en.ageValue, en.ageUnit);
    const given = historyByKey.get(doseKey(en.vaccineCode, en.doseNumber));
    return {
      scheduleEntryId: en.id,
      vaccineCode: en.vaccineCode,
      vaccineName: en.vaccineName,
      doseNumber: en.doseNumber,
      doseLabel: en.doseLabel,
      ageLabel: en.ageLabel,
      originalDueDate: due,
      dueDate: due,
      recordedStatus: given ? 'ADMINISTERED' : 'PENDING',
      administeredOn: given ? given.administeredOn : null,
      isHistorical: !!given,
    };
  });

  const order = new Map(applicable.map((en) => [en.id, en.sortOrder ?? 0]));
  doses.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      (order.get(a.scheduleEntryId) ?? 0) - (order.get(b.scheduleEntryId) ?? 0) ||
      a.vaccineCode.localeCompare(b.vaccineCode) ||
      a.doseNumber - b.doseNumber
  );

  return { doses, errors };
};

/**
 * The status shown to users. Only the "recorded" state is stored; UPCOMING, DUE
 * and OVERDUE are derived from the due date, so they can never go stale.
 */
export const deriveDoseStatus = (
  dose: { recordedStatus: DoseRecordStatus; dueDate: string },
  today: string = todayInIst()
): EffectiveStatus => {
  if (dose.recordedStatus === 'ADMINISTERED') return 'ADMINISTERED';
  if (dose.recordedStatus === 'NOT_GIVEN') return 'NOT_GIVEN';
  if (dose.dueDate > today) return dose.recordedStatus === 'POSTPONED' ? 'POSTPONED' : 'UPCOMING';
  if (dose.dueDate === today) return 'DUE';
  return 'OVERDUE';
};
