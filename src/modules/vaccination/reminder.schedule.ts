/**
 * Reminder timing and decision rules. Pure functions (no database, no clock:
 * pass `now`), so they are unit-tested in reminder.test.ts.
 *
 * Each open dose gets up to four reminders, sent at 09:00 IST:
 *   2 days before, 1 day before, on the due date, and 1 day after.
 */
import { addDays, istDateTime } from './vaccination.dates';

export type ReminderKind = 'TWO_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'ON_DUE_DATE' | 'ONE_DAY_AFTER';

export const REMINDER_KINDS: ReminderKind[] = ['TWO_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'ON_DUE_DATE', 'ONE_DAY_AFTER'];

export const REMINDER_OFFSET_DAYS: Record<ReminderKind, number> = {
  TWO_DAYS_BEFORE: -2,
  ONE_DAY_BEFORE: -1,
  ON_DUE_DATE: 0,
  ONE_DAY_AFTER: 1,
};

export const SEND_HOUR_IST = 9;
/** A reminder that has not been sent this long after its time is dropped (server was down, etc.). */
export const MAX_LATE_MS = 12 * 60 * 60 * 1000;
/** Total tries per reminder, including the first. */
export const MAX_ATTEMPTS = 3;
/** A reminder stuck in PROCESSING this long (crashed server) is put back in the queue. */
export const STUCK_PROCESSING_MS = 10 * 60 * 1000;

export interface PlannedReminder {
  kind: ReminderKind;
  targetDate: string; // the calendar day it is sent (YYYY-MM-DD)
  scheduledFor: Date; // 09:00 IST on that day
}

export const planReminders = (dueDate: string): PlannedReminder[] =>
  REMINDER_KINDS.map((kind) => {
    const targetDate = addDays(dueDate, REMINDER_OFFSET_DAYS[kind]);
    return { kind, targetDate, scheduledFor: istDateTime(targetDate, SEND_HOUR_IST) };
  });

export const isTooLate = (scheduledFor: Date, now: Date): boolean =>
  now.getTime() - scheduledFor.getTime() > MAX_LATE_MS;

/** Wait before try 2 is 15 minutes, before try 3 is 1 hour. */
export const retryDelayMs = (attemptsMade: number): number => (attemptsMade <= 1 ? 15 : 60) * 60 * 1000;

/**
 * Doses due in this range can have a reminder that is relevant today: the
 * 1-day-after reminder of yesterday's dose through the 2-days-before reminder
 * of the day after tomorrow's.
 */
export const reconcileWindow = (today: string): { from: string; to: string } => ({
  from: addDays(today, -1),
  to: addDays(today, 2),
});

export interface OpenDose {
  doseId: string;
  childId: string;
  dueDate: string;
}

export interface ExistingReminder {
  id: string;
  doseId: string;
  kind: ReminderKind;
  dueDateSnapshot: string;
  status: string;
}

export interface ReminderToCreate {
  doseId: string;
  childId: string;
  kind: ReminderKind;
  dueDateSnapshot: string;
  scheduledFor: Date;
}

/**
 * What to create or revive so every open dose has its reminders. Reminders
 * whose time is long past are not created, and nothing already sent, failed or
 * skipped is ever created a second time.
 */
export const planReconcile = (
  openDoses: OpenDose[],
  existing: ExistingReminder[],
  now: Date
): { create: ReminderToCreate[]; revive: string[] } => {
  const byKey = new Map(existing.map((r) => [`${r.doseId}|${r.kind}|${r.dueDateSnapshot}`, r]));
  const create: ReminderToCreate[] = [];
  const revive: string[] = [];

  for (const dose of openDoses) {
    for (const planned of planReminders(dose.dueDate)) {
      if (isTooLate(planned.scheduledFor, now)) continue;
      const found = byKey.get(`${dose.doseId}|${planned.kind}|${dose.dueDate}`);
      if (!found) {
        create.push({
          doseId: dose.doseId,
          childId: dose.childId,
          kind: planned.kind,
          dueDateSnapshot: dose.dueDate,
          scheduledFor: planned.scheduledFor,
        });
      } else if (found.status === 'CANCELLED') {
        revive.push(found.id);
      }
    }
  }
  return { create, revive };
};

/** Why a reminder should no longer be sent, or null if it is still valid. */
export const invalidReason = (
  dueDateSnapshot: string,
  dose: { recordedStatus: string; dueDate: string }
): string | null => {
  if (dose.recordedStatus === 'ADMINISTERED') return 'Dose already given';
  if (dose.recordedStatus === 'NOT_GIVEN') return 'Dose marked as not given';
  if (dose.dueDate !== dueDateSnapshot) return 'Due date changed';
  return null;
};

/** Reminders for the same child, kind and due date are sent as ONE message. */
export const groupKey = (r: { childId: string; kind: string; dueDateSnapshot: string }): string =>
  `${r.childId}|${r.kind}|${r.dueDateSnapshot}`;

export type AttemptOutcome =
  | { status: 'SENT' }
  | { status: 'PENDING'; nextAttemptAt: Date }
  | { status: 'FAILED' };

/** `attemptCount` already includes the attempt that just finished. */
export const decideAfterAttempt = (attemptCount: number, success: boolean, now: Date): AttemptOutcome => {
  if (success) return { status: 'SENT' };
  if (attemptCount >= MAX_ATTEMPTS) return { status: 'FAILED' };
  return { status: 'PENDING', nextAttemptAt: new Date(now.getTime() + retryDelayMs(attemptCount)) };
};
