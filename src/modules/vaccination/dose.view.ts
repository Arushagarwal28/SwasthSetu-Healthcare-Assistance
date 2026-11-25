/**
 * Shared shaping of dose rows for API responses (used by the dose service and
 * the dashboard), plus the age-in-words helper.
 */
import type { Prisma } from '@prisma/client';
import { daysBetween, isValidYmd } from './vaccination.dates';
import { deriveDoseStatus } from './vaccination.schedule';
import type { EffectiveStatus } from './vaccination.schedule';
import { toYmd } from './child.utils';

export const doseInclude = {
  administeredFacility: { select: { id: true, name: true } },
  recordedBy: {
    select: { id: true, email: true, role: true, helperProfile: { select: { fullName: true } } },
  },
} satisfies Prisma.ChildDoseInclude;

export type DoseRow = Prisma.ChildDoseGetPayload<{ include: typeof doseInclude }>;

export interface PersonLike {
  id: string;
  email: string;
  role: string;
  helperProfile: { fullName: string } | null;
}

export const toPerson = (u: PersonLike | null) =>
  u ? { id: u.id, role: u.role, name: u.helperProfile?.fullName ?? u.email } : null;

export const toDoseView = (d: DoseRow, today: string) => {
  const dueDate = toYmd(d.dueDate);
  const status: EffectiveStatus = deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate }, today);
  return {
    id: d.id,
    vaccineCode: d.vaccineCode,
    vaccineName: d.vaccineName,
    doseNumber: d.doseNumber,
    doseLabel: d.doseLabel,
    ageLabel: d.ageLabel,
    originalDueDate: toYmd(d.originalDueDate),
    dueDate,
    recordedStatus: d.recordedStatus,
    status,
    daysOverdue: status === 'OVERDUE' ? daysBetween(dueDate, today) : 0,
    daysUntilDue: dueDate > today ? daysBetween(today, dueDate) : 0,
    administeredOn: d.administeredOn ? toYmd(d.administeredOn) : null,
    administeredFacility: d.administeredFacility,
    recordedBy: toPerson(d.recordedBy),
    isHistorical: d.isHistorical,
    notes: d.notes,
  };
};

export type DoseView = ReturnType<typeof toDoseView>;

/** True while a dose still has to be given (or decided). */
export const isOpenStatus = (s: EffectiveStatus): boolean =>
  s === 'OVERDUE' || s === 'DUE' || s === 'UPCOMING' || s === 'POSTPONED';

/**
 * A child's age in words, using calendar months:
 *   under 1 month -> "12 days", under 2 years -> "7 months", else "3 years 2 months".
 */
export const describeAge = (dob: string, today: string): string => {
  if (!isValidYmd(dob) || !isValidYmd(today) || dob > today) return '';
  const [dy, dm, dd] = dob.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const months = (ty - dy) * 12 + (tm - dm) - (td < dd ? 1 : 0);

  if (months < 1) {
    const days = daysBetween(dob, today);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  if (months < 24) return `${months} ${months === 1 ? 'month' : 'months'}`;

  const years = Math.floor(months / 12);
  const rem = months % 12;
  const y = `${years} years`;
  return rem === 0 ? y : `${y} ${rem} ${rem === 1 ? 'month' : 'months'}`;
};
