/**
 * Rules for changing a dose's recorded status. Pure functions (no database, no
 * clock: pass `today`), so every rule is unit-tested in dose.rules.test.ts.
 *
 * The state machine:
 *   PENDING / POSTPONED -> ADMINISTERED | POSTPONED (new date) | NOT_GIVEN
 *   NOT_GIVEN           -> ADMINISTERED | PENDING (reopen)
 *   ADMINISTERED        -> PENDING (correction of a mistake; a note is required)
 */
import { addYears, isValidYmd } from './vaccination.dates';
import type { DoseRecordStatus } from './vaccination.schedule';

export type DoseAction = 'ADMINISTERED' | 'POSTPONED' | 'NOT_GIVEN' | 'PENDING';
export const DOSE_ACTIONS: DoseAction[] = ['ADMINISTERED', 'POSTPONED', 'NOT_GIVEN', 'PENDING'];

/** How far ahead a dose can be postponed. */
export const MAX_POSTPONE_DAYS = 365;

export interface DoseState {
  recordedStatus: DoseRecordStatus;
  dueDate: string; // YYYY-MM-DD
}

export interface DoseChangeInput {
  action: DoseAction;
  administeredOn?: string | null; // ADMINISTERED (defaults to today)
  newDueDate?: string | null; // POSTPONED
  note?: string | null;
  batchNumber?: string | null; // ADMINISTERED, optional
}

/** What to write to the dose row. Only the fields listed are touched. */
export interface DoseChangePlan {
  toStatus: DoseRecordStatus;
  dueDate: string;
  administeredOn: string | null;
  clearAdministration: boolean; // reset administered facility / recorder / historical flag
  note: string | null;
}

export type DoseChangeResult =
  | { ok: true; plan: DoseChangePlan }
  | { ok: false; status: 400 | 409; error: string };

const fail = (status: 400 | 409, error: string): DoseChangeResult => ({ ok: false, status, error });

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim().replace(/\s+/g, ' ');
  return t === '' ? null : t;
};

const addDaysYmd = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Batch / lot numbers are kept inside the dose note (the table has no column for them). */
export const BATCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/]{1,29}$/;

export const buildDoseNote = (note: string | null, batchNumber: string | null): string | null => {
  const parts: string[] = [];
  if (batchNumber) parts.push(`Batch/lot: ${batchNumber}`);
  if (note) parts.push(note);
  return parts.length ? parts.join('. ') : null;
};

export const planDoseChange = (
  current: DoseState,
  childDateOfBirth: string,
  input: DoseChangeInput,
  today: string
): DoseChangeResult => {
  const note = clean(input.note);
  const batch = clean(input.batchNumber);
  const from = current.recordedStatus;

  switch (input.action) {
    case 'ADMINISTERED': {
      if (from === 'ADMINISTERED') {
        return fail(409, 'This dose is already recorded as given. To correct it, reopen it first.');
      }
      const on = input.administeredOn ? input.administeredOn : today;
      if (!isValidYmd(on)) return fail(400, 'administeredOn must be a real date in YYYY-MM-DD format');
      if (on > today) return fail(400, 'A dose cannot be recorded as given on a future date');
      if (on < childDateOfBirth) return fail(400, 'A dose cannot be given before the date of birth');
      if (batch && !BATCH_PATTERN.test(batch)) {
        return fail(400, 'Batch number may contain letters, digits, - _ / and be 2 to 30 characters long');
      }
      return {
        ok: true,
        plan: {
          toStatus: 'ADMINISTERED',
          dueDate: current.dueDate,
          administeredOn: on,
          clearAdministration: false,
          note: buildDoseNote(note, batch),
        },
      };
    }

    case 'POSTPONED': {
      if (from === 'ADMINISTERED') {
        return fail(409, 'A dose that has been given cannot be postponed. Reopen it first if it was recorded by mistake.');
      }
      if (from === 'NOT_GIVEN') return fail(409, 'Reopen this dose before postponing it');
      const nd = input.newDueDate ?? '';
      if (!isValidYmd(nd)) return fail(400, 'newDueDate must be a real date in YYYY-MM-DD format');
      if (nd <= today) return fail(400, 'The new due date must be after today');
      if (nd > addDaysYmd(today, MAX_POSTPONE_DAYS)) {
        return fail(400, `A dose cannot be postponed by more than ${MAX_POSTPONE_DAYS} days`);
      }
      if (nd > addYears(childDateOfBirth, 19)) return fail(400, 'The new due date is too far in the future');
      if (nd === current.dueDate) return fail(409, 'The dose is already due on that date');
      if (!note) return fail(400, 'Please give a reason for postponing');
      return {
        ok: true,
        plan: { toStatus: 'POSTPONED', dueDate: nd, administeredOn: null, clearAdministration: false, note },
      };
    }

    case 'NOT_GIVEN': {
      if (from === 'ADMINISTERED') {
        return fail(409, 'A dose that has been given cannot be marked as not given. Reopen it first.');
      }
      if (from === 'NOT_GIVEN') return fail(409, 'This dose is already marked as not given');
      if (!note) return fail(400, 'Please give a reason (for example: child unwell, parent declined, vaccine unavailable)');
      return {
        ok: true,
        plan: { toStatus: 'NOT_GIVEN', dueDate: current.dueDate, administeredOn: null, clearAdministration: false, note },
      };
    }

    case 'PENDING': {
      if (from === 'PENDING') return fail(409, 'This dose is already pending');
      if (from === 'POSTPONED') return fail(409, 'Use ADMINISTERED or NOT_GIVEN for a postponed dose, or postpone it again');
      if (!note) return fail(400, 'Please explain why this record is being reopened');
      return {
        ok: true,
        plan: { toStatus: 'PENDING', dueDate: current.dueDate, administeredOn: null, clearAdministration: true, note },
      };
    }

    default:
      return fail(400, 'Unknown action');
  }
};
