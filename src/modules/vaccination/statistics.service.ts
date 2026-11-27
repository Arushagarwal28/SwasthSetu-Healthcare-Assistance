import { prisma } from '../../config/prisma';
import { childAccessFilter } from './child.access';
import type { Actor } from './child.access';
import { addDays, todayInIst } from './vaccination.dates';
import { ymdToDate } from './child.utils';
import { buildVaccineCoverage } from './statistics.rules';

/**
 * Whole-system numbers for the administrator. AGGREGATES ONLY: no child's name,
 * contact details or individual record appears here.
 *
 * Facility figures describe vaccination activity (doses actually administered
 * there), never child ownership: a child belongs to no facility.
 */
export const getAdminStats = async (now: Date = new Date()) => {
  const today = todayInIst(now);
  const t = ymdToDate(today);
  const open = { in: ['PENDING', 'POSTPONED'] as ('PENDING' | 'POSTPONED')[] };
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  const [
    childrenTotal, childrenLast30Days, byRecordedStatus, overdueDoses, dueToday, upcoming7,
    statusByVaccine, pastDueByVaccine, childrenByDistrict, dosesByFacility, recentDosesByFacility,
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
    prisma.childDose.groupBy({
      by: ['administeredFacilityId'],
      where: { recordedStatus: 'ADMINISTERED', administeredFacilityId: { not: null } },
      _count: { _all: true },
    }),
    prisma.childDose.groupBy({
      by: ['administeredFacilityId'],
      where: {
        recordedStatus: 'ADMINISTERED',
        administeredFacilityId: { not: null },
        administeredOn: { gte: ymdToDate(addDays(today, -30)) },
      },
      _count: { _all: true },
    }),
    prisma.vaccinationReminder.groupBy({ by: ['status'], where: { scheduledFor: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.reminderDelivery.groupBy({ by: ['channel', 'status'], where: { attemptedAt: { gte: sevenDaysAgo } }, _count: { _all: true } }),
    prisma.facilityVaccine.groupBy({ by: ['facilityId'], where: { isActive: true }, _count: { _all: true } }),
  ]);

  const statusCount = (s: string) => byRecordedStatus.find((r) => r.recordedStatus === s)?._count._all ?? 0;
  const totalDoses = byRecordedStatus.reduce((n, r) => n + r._count._all, 0);

  // Facility activity: doses administered there, all time and in the last 30 days.
  const recentByFacility = new Map(
    recentDosesByFacility.map((r) => [r.administeredFacilityId as string, r._count._all])
  );
  const topFacilities = dosesByFacility
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 10);
  const facilityNames = await prisma.facility.findMany({
    where: { id: { in: topFacilities.map((f) => f.administeredFacilityId as string) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(facilityNames.map((f) => [f.id, f.name]));

  return {
    asOf: today,
    children: {
      total: childrenTotal,
      registeredLast30Days: childrenLast30Days,
      byDistrict: childrenByDistrict
        .map((r) => ({ district: r.district, count: r._count._all }))
        .sort((a, b) => b.count - a.count || a.district.localeCompare(b.district))
        .slice(0, 20),
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
    activity: {
      dosesByFacility: topFacilities.map((f) => {
        const facilityId = f.administeredFacilityId as string;
        return {
          facilityId,
          name: nameById.get(facilityId) ?? 'Unknown facility',
          total: f._count._all,
          last30Days: recentByFacility.get(facilityId) ?? 0,
        };
      }),
      facilitiesWithActivity: dosesByFacility.length,
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

/**
 * Numbers for one helper / staff member's own accessible children, plus the
 * activity at the facilities a staff member is linked to. Facility activity is
 * computed from doses administered and encounters recorded there; it does not
 * expose any child's record.
 */
export const getScopeStats = async (actor: Actor, now: Date = new Date()) => {
  const today = todayInIst(now);
  const t = ymdToDate(today);
  const access = await childAccessFilter(actor);
  const open = { in: ['PENDING', 'POSTPONED'] as ('PENDING' | 'POSTPONED')[] };
  const base = { recordedStatus: open, child: access };
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

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

  let facilityActivity: {
    facilityId: string;
    name: string;
    dosesAdministeredLast30Days: number;
    encountersLast30Days: number;
  }[] = [];

  if (actor.role === 'HOSPITAL_STAFF') {
    const links = await prisma.hospitalStaffFacilityLink.findMany({
      where: { userId: actor.userId, facility: { isActive: true } },
      select: { facilityId: true },
    });
    const facilityIds = links.map((l) => l.facilityId);
    if (facilityIds.length > 0) {
      const [facilities, doses, encounters] = await Promise.all([
        prisma.facility.findMany({ where: { id: { in: facilityIds } }, select: { id: true, name: true } }),
        prisma.childDose.groupBy({
          by: ['administeredFacilityId'],
          where: {
            administeredFacilityId: { in: facilityIds },
            recordedStatus: 'ADMINISTERED',
            administeredOn: { gte: ymdToDate(addDays(today, -30)) },
          },
          _count: { _all: true },
        }),
        prisma.childDoseEvent.groupBy({
          by: ['facilityId'],
          where: { facilityId: { in: facilityIds }, createdAt: { gte: thirtyDaysAgo } },
          _count: { _all: true },
        }),
      ]);
      const doseMap = new Map(doses.map((d) => [d.administeredFacilityId as string, d._count._all]));
      const eventMap = new Map(encounters.map((e) => [e.facilityId as string, e._count._all]));
      facilityActivity = facilities
        .map((f) => ({
          facilityId: f.id,
          name: f.name,
          dosesAdministeredLast30Days: doseMap.get(f.id) ?? 0,
          encountersLast30Days: eventMap.get(f.id) ?? 0,
        }))
        .sort((a, b) => b.dosesAdministeredLast30Days - a.dosesAdministeredLast30Days || a.name.localeCompare(b.name));
    }
  }

  return {
    asOf: today,
    children,
    childrenWithOverdue,
    overdueDoses,
    dueToday,
    dueNext7Days: upcoming7,
    administeredLast30Days: administeredLast30,
    facilityActivity,
  };
};
