import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { childAccessFilter } from './child.access';
import type { Actor } from './child.access';
import { addDays, daysBetween, todayInIst } from './vaccination.dates';
import { deriveDoseStatus } from './vaccination.schedule';
import { formatRecordNumber, toYmd, ymdToDate } from './child.utils';

export type WorklistStatus = 'OVERDUE' | 'DUE' | 'UPCOMING' | 'ALL';

export interface WorklistOptions {
  status: WorklistStatus;
  days: number; // how far ahead "upcoming" looks
  page: number;
  limit: number;
  search?: string | undefined;
}

const OPEN: Prisma.ChildDoseWhereInput['recordedStatus'] = { in: ['PENDING', 'POSTPONED'] };

const dueFilter = (
  status: WorklistStatus,
  today: string,
  days: number
): NonNullable<Prisma.ChildDoseWhereInput['dueDate']> => {
  const t = ymdToDate(today);
  const horizon = ymdToDate(addDays(today, days));
  switch (status) {
    case 'OVERDUE':
      return { lt: t };
    case 'DUE':
      return { equals: t };
    case 'UPCOMING':
      return { gt: t, lte: horizon };
    default:
      return { lte: horizon };
  }
};

/**
 * "Who needs a vaccine?" for the children this user can access: overdue,
 * due today and coming up. The main list on the helper / staff dashboards.
 */
export const getWorklist = async (actor: Actor, opts: WorklistOptions) => {
  const today = todayInIst();
  const access = await childAccessFilter(actor);

  // No facility filter: a child is not owned by a facility, and a staff member's
  // worklist is exactly the set of children they hold a live grant for.
  const childFilter: Prisma.ChildWhereInput = {
    AND: [
      access,
      ...(opts.search ? [{ fullName: { contains: opts.search, mode: 'insensitive' as const } }] : []),
    ],
  };

  const where: Prisma.ChildDoseWhereInput = {
    recordedStatus: OPEN,
    dueDate: dueFilter(opts.status, today, opts.days),
    child: childFilter,
  };

  const scope: Prisma.ChildDoseWhereInput = { recordedStatus: OPEN, child: access };
  const [total, rows, overdue, dueToday, upcoming] = await prisma.$transaction([
    prisma.childDose.count({ where }),
    prisma.childDose.findMany({
      where,
      orderBy: [{ dueDate: 'asc' }, { child: { fullName: 'asc' } }],
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        vaccineName: true,
        doseLabel: true,
        dueDate: true,
        recordedStatus: true,
        child: {
          select: { id: true, recordNumber: true, fullName: true, village: true, district: true, primaryMobile: true },
        },
      },
    }),
    prisma.childDose.count({ where: { ...scope, dueDate: dueFilter('OVERDUE', today, opts.days) } }),
    prisma.childDose.count({ where: { ...scope, dueDate: dueFilter('DUE', today, opts.days) } }),
    prisma.childDose.count({ where: { ...scope, dueDate: dueFilter('UPCOMING', today, opts.days) } }),
  ]);

  return {
    asOf: today,
    summary: { overdue, dueToday, upcoming, upcomingDays: opts.days },
    total,
    page: opts.page,
    limit: opts.limit,
    items: rows.map((d) => {
      const dueDate = toYmd(d.dueDate);
      const status = deriveDoseStatus({ recordedStatus: d.recordedStatus, dueDate }, today);
      return {
        doseId: d.id,
        childId: d.child.id,
        recordNumber: formatRecordNumber(d.child.recordNumber),
        childName: d.child.fullName,
        village: d.child.village,
        district: d.child.district,
        parentMobile: d.child.primaryMobile,
        vaccineName: d.vaccineName,
        doseLabel: d.doseLabel,
        dueDate,
        status,
        daysOverdue: status === 'OVERDUE' ? daysBetween(dueDate, today) : 0,
        daysUntilDue: dueDate > today ? daysBetween(today, dueDate) : 0,
      };
    }),
  };
};
