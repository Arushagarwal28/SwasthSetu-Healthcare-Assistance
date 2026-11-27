/**
 * Reminder engine: creates reminder rows, sends them (in-app + SMS), records every attempt.
 *
 * Safe to run on a timer, and safe if two copies run at once: a reminder is
 * claimed with an atomic PENDING -> PROCESSING update, so only one worker can
 * ever send it.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter } from './child.access';
import type { Actor } from './child.access';
import { todayInIst } from './vaccination.dates';
import { INDIAN_MOBILE, toYmd, ymdToDate } from './child.utils';
import {
  STUCK_PROCESSING_MS, decideAfterAttempt, groupKey, invalidReason, isTooLate, planReconcile, reconcileWindow,
} from './reminder.schedule';
import type { ReminderKind } from './reminder.schedule';
import { buildNotification, buildSmsText, templateKey } from './reminder.templates';
import { maskPhone, toE164India } from './sms.provider';
import type { SmsProvider } from './sms.provider';

const BATCH_LIMIT = 200;

export interface CycleStats {
  created: number;
  revived: number;
  cancelled: number;
  recovered: number;
  groupsProcessed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

export const emptyStats = (): CycleStats => ({
  created: 0, revived: 0, cancelled: 0, recovered: 0, groupsProcessed: 0, sent: 0, retried: 0, failed: 0, skipped: 0,
});

// ---------------------------------------------------------------------------
// 1. Make sure every open dose has its reminders (and stale ones are cancelled)
// ---------------------------------------------------------------------------

// The archived child-facility assignments are historical only. They are kept for
// a bounded period for audit/reconciliation and then purged; they store no
// personal data beyond the two identifiers.
export const ASSIGNMENT_ARCHIVE_RETENTION_DAYS = 180;

export const reconcileReminders = async (now: Date, stats: CycleStats): Promise<void> => {
  await prisma.childFacilityAssignmentArchive.deleteMany({
    where: { archivedAt: { lt: new Date(now.getTime() - ASSIGNMENT_ARCHIVE_RETENTION_DAYS * 86_400_000) } },
  });

  const { from, to } = reconcileWindow(todayInIst(now));

  const doses = await prisma.childDose.findMany({
    where: {
      recordedStatus: { in: ['PENDING', 'POSTPONED'] },
      dueDate: { gte: ymdToDate(from), lte: ymdToDate(to) },
    },
    select: { id: true, childId: true, dueDate: true },
  });
  const openDoses = doses.map((d) => ({ doseId: d.id, childId: d.childId, dueDate: toYmd(d.dueDate) }));

  if (openDoses.length > 0) {
    const rows = await prisma.vaccinationReminder.findMany({
      where: { doseId: { in: openDoses.map((d) => d.doseId) } },
      select: { id: true, doseId: true, kind: true, dueDateSnapshot: true, status: true },
    });
    const plan = planReconcile(
      openDoses,
      rows.map((r) => ({
        id: r.id,
        doseId: r.doseId,
        kind: r.kind,
        dueDateSnapshot: toYmd(r.dueDateSnapshot),
        status: r.status,
      })),
      now
    );

    if (plan.create.length > 0) {
      const made = await prisma.vaccinationReminder.createMany({
        data: plan.create.map((c) => ({
          doseId: c.doseId,
          childId: c.childId,
          kind: c.kind,
          dueDateSnapshot: ymdToDate(c.dueDateSnapshot),
          scheduledFor: c.scheduledFor,
        })),
        skipDuplicates: true,
      });
      stats.created += made.count;
    }
    if (plan.revive.length > 0) {
      const revived = await prisma.vaccinationReminder.updateMany({
        where: { id: { in: plan.revive }, status: 'CANCELLED' },
        data: { status: 'PENDING', skipReason: null, attemptCount: 0, nextAttemptAt: null, processedAt: null },
      });
      stats.revived += revived.count;
    }
  }

  // Cancel waiting reminders whose dose has since been given, marked not given, or moved to another date
  const waiting = await prisma.vaccinationReminder.findMany({
    where: { status: 'PENDING' },
    select: { id: true, dueDateSnapshot: true, dose: { select: { recordedStatus: true, dueDate: true } } },
  });
  const stale = waiting
    .filter(
      (r) =>
        invalidReason(toYmd(r.dueDateSnapshot), {
          recordedStatus: r.dose.recordedStatus,
          dueDate: toYmd(r.dose.dueDate),
        }) !== null
    )
    .map((r) => r.id);
  if (stale.length > 0) {
    const cancelled = await prisma.vaccinationReminder.updateMany({
      where: { id: { in: stale }, status: 'PENDING' },
      data: { status: 'CANCELLED', skipReason: 'Dose changed', processedAt: now },
    });
    stats.cancelled += cancelled.count;
  }
};

// ---------------------------------------------------------------------------
// 2. Send the reminders that are due
// ---------------------------------------------------------------------------

const readyWhere = (now: Date): Prisma.VaccinationReminderWhereInput => ({
  status: 'PENDING',
  scheduledFor: { lte: now },
  OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
});

export const processDueReminders = async (
  now: Date,
  provider: SmsProvider,
  stats: CycleStats
): Promise<void> => {
  // A crashed worker leaves rows in PROCESSING; put them back in the queue
  const recovered = await prisma.vaccinationReminder.updateMany({
    where: { status: 'PROCESSING', updatedAt: { lt: new Date(now.getTime() - STUCK_PROCESSING_MS) } },
    data: { status: 'PENDING' },
  });
  stats.recovered += recovered.count;

  const due = await prisma.vaccinationReminder.findMany({
    where: readyWhere(now),
    orderBy: { scheduledFor: 'asc' },
    take: BATCH_LIMIT,
    select: { childId: true, kind: true, dueDateSnapshot: true },
  });

  const seen = new Set<string>();
  for (const r of due) {
    const key = groupKey({ childId: r.childId, kind: r.kind, dueDateSnapshot: toYmd(r.dueDateSnapshot) });
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      await processGroup(r.childId, r.kind, r.dueDateSnapshot, now, provider, stats);
    } catch (err) {
      // One bad group must not stop the others. Its rows stay PROCESSING and are recovered later.
      console.error('[reminders] group failed:', err instanceof Error ? err.message : err);
    }
  }
};

/** All reminders of one child, one kind and one due date are sent as a single message. */
const processGroup = async (
  childId: string,
  kind: ReminderKind,
  dueDateSnapshot: Date,
  now: Date,
  provider: SmsProvider,
  stats: CycleStats
): Promise<void> => {
  const candidates = await prisma.vaccinationReminder.findMany({
    where: { AND: [readyWhere(now), { childId, kind, dueDateSnapshot }] },
    select: { id: true },
  });

  // Claim each one; whoever wins the update owns it
  const claimedIds: string[] = [];
  for (const c of candidates) {
    const won = await prisma.vaccinationReminder.updateMany({
      where: { id: c.id, status: 'PENDING' },
      data: { status: 'PROCESSING', attemptCount: { increment: 1 } },
    });
    if (won.count === 1) claimedIds.push(c.id);
  }
  if (claimedIds.length === 0) return;
  stats.groupsProcessed += 1;

  const rows = await prisma.vaccinationReminder.findMany({
    where: { id: { in: claimedIds } },
    include: {
      dose: { select: { id: true, vaccineName: true, recordedStatus: true, dueDate: true } },
      child: {
        select: {
          id: true, fullName: true, primaryMobile: true, smsConsent: true,
          preferredLanguage: true, registeredById: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Drop reminders for doses that were given / moved in the meantime
  const valid: typeof rows = [];
  for (const row of rows) {
    const reason = invalidReason(toYmd(row.dueDateSnapshot), {
      recordedStatus: row.dose.recordedStatus,
      dueDate: toYmd(row.dose.dueDate),
    });
    if (reason) {
      await prisma.vaccinationReminder.update({
        where: { id: row.id },
        data: { status: 'CANCELLED', skipReason: reason, processedAt: now },
      });
      stats.cancelled += 1;
    } else {
      valid.push(row);
    }
  }
  const lead = valid[0];
  if (!lead) return;
  const child = lead.child;
  const attempt = Math.max(...valid.map((r) => r.attemptCount));
  const ids = valid.map((r) => r.id);

  // Missed its window (server was down): drop it rather than send a stale reminder
  if (attempt === 1 && isTooLate(lead.scheduledFor, now)) {
    await prisma.vaccinationReminder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'SKIPPED', skipReason: 'Missed its sending window', processedAt: now },
    });
    stats.skipped += ids.length;
    return;
  }

  const dueYmd = toYmd(dueDateSnapshot);
  const vaccineNames: string[] = [...new Set<string>(valid.map((r) => r.dose.vaccineName))].sort();
  const lang = child.preferredLanguage;

  // In-app notification: once, on the first attempt
  if (attempt === 1) {
    // D3: notify the healthcare worker who registered the child (and the
    // guardian by SMS below). There is no facility-wide fan-out: being linked to
    // a facility must not reveal a child's reminders. Notifications are also
    // subject to child-access checks when opened, and the unique key below keeps
    // them from being duplicated.
    const recipients = [child.registeredById];
    const text = buildNotification({ kind, childName: child.fullName, vaccineNames, dueDate: dueYmd });

    await prisma.vaccinationNotification.createMany({
      data: recipients.map((userId) => ({
        userId,
        childId: child.id,
        doseId: lead.dose.id,
        reminderId: lead.id,
        title: text.title,
        body: text.body,
      })),
      skipDuplicates: true,
    });
    await prisma.reminderDelivery.createMany({
      data: valid.map((r) => ({
        reminderId: r.id,
        channel: 'IN_APP' as const,
        status: 'SENT' as const,
        provider: 'in-app',
        templateKey: templateKey(kind, 'EN'),
        attemptNumber: 1,
      })),
      skipDuplicates: true,
    });
  }

  // SMS: consent and number are checked NOW, not when the reminder was scheduled
  let smsOk = true;
  let lastError: string | null = null;
  const deliveries: Prisma.ReminderDeliveryCreateManyInput[] = [];
  const base = (r: (typeof valid)[number]) => ({
    reminderId: r.id,
    channel: 'SMS' as const,
    provider: provider.name,
    recipientMasked: maskPhone(child.primaryMobile),
    templateKey: templateKey(kind, lang),
    attemptNumber: r.attemptCount,
  });

  if (!child.smsConsent) {
    for (const r of valid) deliveries.push({ ...base(r), status: 'SKIPPED', errorMessage: 'Parent has not consented to SMS' });
  } else if (!INDIAN_MOBILE.test(child.primaryMobile)) {
    for (const r of valid) deliveries.push({ ...base(r), status: 'SKIPPED', errorMessage: 'No valid mobile number' });
  } else {
    try {
      const sent = await provider.send({
        to: toE164India(child.primaryMobile),
        text: buildSmsText({ kind, lang, childName: child.fullName, vaccineNames, dueDate: dueYmd }),
        templateKey: templateKey(kind, lang),
      });
      for (const r of valid) {
        deliveries.push({ ...base(r), status: 'SENT', providerMessageId: sent.providerMessageId, providerResponse: sent.raw });
      }
    } catch (err) {
      smsOk = false;
      lastError = (err instanceof Error ? err.message : String(err)).slice(0, 500);
      for (const r of valid) deliveries.push({ ...base(r), status: 'FAILED', errorMessage: lastError });
    }
  }
  await prisma.reminderDelivery.createMany({ data: deliveries, skipDuplicates: true });

  // Final state: sent, try again later, or give up
  const outcome = decideAfterAttempt(attempt, smsOk, now);
  if (outcome.status === 'SENT') {
    await prisma.vaccinationReminder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'SENT', processedAt: now, lastError: null, nextAttemptAt: null },
    });
    stats.sent += ids.length;
  } else if (outcome.status === 'PENDING') {
    await prisma.vaccinationReminder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PENDING', nextAttemptAt: outcome.nextAttemptAt, lastError },
    });
    stats.retried += ids.length;
  } else {
    await prisma.vaccinationReminder.updateMany({
      where: { id: { in: ids } },
      data: { status: 'FAILED', processedAt: now, lastError, nextAttemptAt: null },
    });
    stats.failed += ids.length;
  }
};

// ---------------------------------------------------------------------------
// 3. Reading
// ---------------------------------------------------------------------------

/** Reminder history for one child, with every delivery attempt (numbers are masked). */
export const listChildReminders = async (actor: Actor, childId: string, limit = 60) => {
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    select: { id: true },
  });
  if (!child) throw new AppError('Child not found', 404);

  const rows = await prisma.vaccinationReminder.findMany({
    where: { childId: child.id },
    orderBy: { scheduledFor: 'desc' },
    take: limit,
    include: {
      dose: { select: { vaccineName: true, doseLabel: true } },
      deliveries: { orderBy: { attemptedAt: 'asc' } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    skipReason: r.skipReason,
    vaccineName: r.dose.vaccineName,
    doseLabel: r.dose.doseLabel,
    dueDate: toYmd(r.dueDateSnapshot),
    scheduledFor: r.scheduledFor,
    attemptCount: r.attemptCount,
    nextAttemptAt: r.nextAttemptAt,
    lastError: r.lastError,
    processedAt: r.processedAt,
    deliveries: r.deliveries.map((d) => ({
      channel: d.channel,
      status: d.status,
      provider: d.provider,
      recipient: d.recipientMasked,
      attemptNumber: d.attemptNumber,
      attemptedAt: d.attemptedAt,
      error: d.errorMessage,
    })),
  }));
};
