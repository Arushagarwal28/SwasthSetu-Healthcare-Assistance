import { prisma } from '../../config/prisma';
import { childAccessFilter } from './child.access';
import type { Actor } from './child.access';
import { addDays, todayInIst } from './vaccination.dates';
import { ymdToDate } from './child.utils';
import { buildVaccineCoverage } from './statistics.rules';

/**
 * Whole-system numbers for the administrator. AGGREGATES ONLY: no child's name,
 * contact details or individual record appears here.
 */
export const getAdminStats = async (now: Date = new Date()) => {
  const today = todayInIst(now);
  const t = ymdToDate(today);
  const open = { in: ['PENDING', 'POSTPONED'] as ('PENDING' | 'POSTPONED')[] };
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    childrenTotal, childrenLast30Days, byRecordedStatus, overdueDoses, dueToday, upcoming7,
    statusByVaccine, pastDueByVaccine, childrenByDistrict, childrenByFacility,
    remindersLast7, deliveriesLast7, facilitiesWithServices,
  ] = await Promise.all([
    prisma.child.count(),
    prisma.child.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.childDose.groupBy({ by: ['recordedStatus'], _count: { _all: true } }),
    prisma.childDose.count({ where: { recordedStatus: open, dueDate: { lt: t } } }),
    prisma.childDose.count({ where: { recordedStatus: open, dueDate: { equals: t } } }),
    prisma.childDose.count({ where: { recordedStatus: open, dueDate: { gt: t, lte: ymdToDate(addDays(today, 7)) } } }),
    prisma.childDose.groupBy({ by: ['vaccineCode', 'recordedStatus'], _count: { _all: true } }),
    prisma.childDose.groupBy({ by: ['vaccineCode'], where: { recordedStatus: open, dueDate: { lte: t } }, _count: { _all: true } }),
    prisma.child.groupBy({ by: ['district'], _count: { _all: true } }),
    prisma.child.groupBy({ by: ['assignedFacilityId'], _count: { _all: true } }),
    prisma.vaccinationReminder.groupBy({ by: ['status'], where: { scheduledFor: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.reminderDelivery.groupBy({ by: ['channel', 'status'], where: { attemptedAt: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.facilityVaccine.groupBy({ by: ['facilityId'], where: { isActive: true }, _count: { _all: true } }),
  ]);

  const statusCount = (s: string) => byRecordedStatus.find((r) => r.recordedStatus === s)?._count._all ?? 0;
  const totalDoses = byRecordedStatus.reduce((n, r) => n + r._count._all, 0);

  // Names for the busiest facilities
  const topFacilities = childrenByFacility
    .filter((r) => r.assignedFacilityId !== null)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 10);
  const facilityNames = await prisma.facility.findMany({
    where: { id: { in: topFacilities.map((f) => f.assignedFacilityId as string) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(facilityNames.map((f) => [f.id, f.name]));

  return {
    asOf: today,
    children: {
      total: childrenTotal,
      registeredLast30Days: childrenLast30Days,
      withoutFacility: childrenByFacility.find((r) => r.assignedFacilityId === null)?._count._all ?? 0,
      byDistrict: childrenByDistrict
        .map((r) => ({ district: r.district, count: r._count._all }))
        .sort((a, b) => b.count - a.count || a.district.localeCompare(b.district))
        .slice(0, 20),
      topFacilities: topFacilities.map((f) => ({
        facilityId: f.assignedFacilityId,
        name: nameById.get(f.assignedFacilityId as string) ?? 'Unknown facility',
        count: f._count._all,
      })),
    },
    doses: {
      total: totalDoses,
      administered: statusCount('ADMINISTERED'),
      pending: statusCount('PENDING'),
      postponed: statusCount('POSTPONED'),
      notGiven: statusCount('NOT_GIVEN'),
      overdue: overdueDoses,
      dueToday,
      dueNext7Days: upcoming7,
    },
    byVaccine: buildVaccineCoverage(
      statusByVaccine.map((r) => ({ vaccineCode: r.vaccineCode, recordedStatus: r.recordedStatus, count: r._count._all })),
      pastDueByVaccine.map((r) => ({ vaccineCode: r.vaccineCode, count: r._count._all }))
    ),
    reminders: {
      last7Days: Object.fromEntries(remindersLast7.map((r) => [r.status, r._count._all])),
      deliveriesLast7Days: deliveriesLast7.map((r) => ({ channel: r.channel, status: r.status, count: r._count._all })),
    },
    centres: { facilitiesOfferingVaccines: facilitiesWithServices.length },
  };
};

/** Numbers for one helper / staff member's own children (their dashboard header). */
export const getScopeStats = async (actor: Actor, now: Date = new Date()) => {
  const today = todayInIst(now);
  const t = ymdToDate(today);
  const access = await childAccessFilter(actor);
  const open = { in: ['PENDING', 'POSTPONED'] as ('PENDING' | 'POSTPONED')[] };
  const base = { recordedStatus: open, child: access };

  const [children, childrenWithOverdue, overdueDoses, dueToday, upcoming7, administeredLast30] = await Promise.all([
    prisma.child.count({ where: access }),
    prisma.child.count({ where: { AND: [access, { doses: { some: { recordedStatus: open, dueDate: { lt: t } } } }] } }),
    prisma.childDose.count({ where: { ...base, dueDate: { lt: t } } }),
    prisma.childDose.count({ where: { ...base, dueDate: { equals: t } } }),
    prisma.childDose.count({ where: { ...base, dueDate: { gt: t, lte: ymdToDate(addDays(today, 7)) } } }),
    prisma.childDose.count({
      where: {
        recordedStatus: 'ADMINISTERED',
        isHistorical: false,
        administeredOn: { gte: ymdToDate(addDays(today, -30)) },
        child: access,
      },
    }),
  ]);

  return {
    asOf: today,
    children,
    childrenWithOverdue,
    overdueDoses,
    dueToday,
    dueNext7Days: upcoming7,
    administeredLast30Days: administeredLast30,
  };
};
