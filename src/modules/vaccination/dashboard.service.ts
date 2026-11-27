import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childAccessFilter, describeChildAccess } from './child.access';
import type { Actor } from './child.access';
import { todayInIst } from './vaccination.dates';
import { formatRecordNumber, toYmd } from './child.utils';
import { describeAge, doseInclude, toDoseView, toPerson } from './dose.view';
import type { DoseView } from './dose.view';

const byDue = (a: DoseView, b: DoseView) =>
  a.dueDate.localeCompare(b.dueDate) || a.vaccineCode.localeCompare(b.vaccineCode) || a.doseNumber - b.doseNumber;

/**
 * Everything the child's page needs in one call: who the child is, what is
 * overdue, what is next, what is finished, and the latest changes.
 */
export const getChildDashboard = async (actor: Actor, childId: string) => {
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    include: {
      registeredBy: {
        select: { id: true, email: true, role: true, helperProfile: { select: { fullName: true } } },
      },
      doses: { include: doseInclude },
    },
  });
  // 404 rather than 403, so the existence of other people's children is not revealed
  if (!child) throw new AppError('Child not found', 404);

  const access = await describeChildAccess(actor, { id: child.id });
  const today = todayInIst();
  const doses = child.doses.map((d) => toDoseView(d, today));

  const overdue = doses.filter((d) => d.status === 'OVERDUE').sort(byDue);
  const dueToday = doses.filter((d) => d.status === 'DUE').sort(byDue);
  const upcoming = doses.filter((d) => d.status === 'UPCOMING' || d.status === 'POSTPONED').sort(byDue);
  const completed = doses
    .filter((d) => d.status === 'ADMINISTERED')
    .sort((a, b) => (b.administeredOn ?? '').localeCompare(a.administeredOn ?? ''));
  const notGiven = doses.filter((d) => d.status === 'NOT_GIVEN').sort(byDue);

  // The next visit is the earliest date that is today or later; every dose due
  // on that date can be given at the same session.
  const nextPool = [...dueToday, ...upcoming];
  const nextDate = nextPool[0]?.dueDate ?? null;
  const nextVisit = nextDate ? { date: nextDate, doses: nextPool.filter((d) => d.dueDate === nextDate) } : null;

  const recentEvents = await prisma.childDoseEvent.findMany({
    where: { dose: { childId: child.id } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      dose: { select: { vaccineName: true, doseLabel: true } },
      facility: { select: { id: true, name: true } },
      changedBy: {
        select: { id: true, email: true, role: true, helperProfile: { select: { fullName: true } } },
      },
    },
  });

  const total = doses.length;
  return {
    child: {
      id: child.id,
      recordNumber: formatRecordNumber(child.recordNumber),
      fullName: child.fullName,
      dateOfBirth: toYmd(child.dateOfBirth),
      age: describeAge(toYmd(child.dateOfBirth), today),
      gender: child.gender,
      village: child.village,
      district: child.district,
      jeEndemicArea: child.jeEndemicArea,
      preferredLanguage: child.preferredLanguage,
      smsConsent: child.smsConsent,
      registeredBy: toPerson(child.registeredBy),
    },
    asOf: today,
    accessType: access.accessType,
    accessExpiresAt: access.accessExpiresAt,
    summary: {
      total,
      administered: completed.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      upcoming: upcoming.length,
      notGiven: notGiven.length,
      completionPercent: total === 0 ? 0 : Math.round((completed.length / total) * 100),
    },
    overdue,
    dueToday,
    nextVisit,
    upcoming,
    completed,
    notGiven,
    recentActivity: recentEvents.map((e) => ({
      id: e.id,
      at: e.createdAt,
      vaccineName: e.dose.vaccineName,
      doseLabel: e.dose.doseLabel,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      fromDueDate: e.fromDueDate ? toYmd(e.fromDueDate) : null,
      toDueDate: e.toDueDate ? toYmd(e.toDueDate) : null,
      facility: e.facility,
      note: e.note,
      changedBy: toPerson(e.changedBy),
    })),
  };
};

/** The complete audit trail for a child, newest first. */
export const getChildHistory = async (actor: Actor, childId: string, page: number, limit: number) => {
  const child = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childAccessFilter(actor)] },
    select: { id: true },
  });
  if (!child) throw new AppError('Child not found', 404);

  const where = { dose: { childId: child.id } };
  const [total, rows] = await prisma.$transaction([
    prisma.childDoseEvent.count({ where }),
    prisma.childDoseEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        dose: { select: { id: true, vaccineName: true, doseLabel: true } },
        facility: { select: { id: true, name: true } },
        changedBy: {
          select: { id: true, email: true, role: true, helperProfile: { select: { fullName: true } } },
        },
      },
    }),
  ]);

  return {
    total,
    page,
    limit,
    items: rows.map((e) => ({
      id: e.id,
      at: e.createdAt,
      doseId: e.dose.id,
      vaccineName: e.dose.vaccineName,
      doseLabel: e.dose.doseLabel,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      fromDueDate: e.fromDueDate ? toYmd(e.fromDueDate) : null,
      toDueDate: e.toDueDate ? toYmd(e.toDueDate) : null,
      facility: e.facility,
      note: e.note,
      changedBy: toPerson(e.changedBy),
    })),
  };
};
