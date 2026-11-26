/**
 * Aggregate statistics for administrators.
 *
 * Every number here is a count or an average over the whole population. No
 * report id, patient id, patient name, test name, value or free text is ever
 * returned, so an administrator cannot single out an individual.
 */
import { prisma } from '../../config/prisma';

const MIN_BUCKET = 5;

/** Counts below the minimum bucket are suppressed to prevent re-identification. */
const suppress = (count: number): number | null => (count > 0 && count < MIN_BUCKET ? null : count);

export async function adminStatistics(days = 90) {
  const windowDays = [7, 30, 90, 365].includes(days) ? days : 90;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [
    totalReports,
    recentReports,
    byStatus,
    byType,
    usage,
    corrections,
    shares,
    auditByAction,
    monthlyRaw,
  ] = await Promise.all([
    prisma.medicalReport.count(),
    prisma.medicalReport.count({ where: { createdAt: { gte: since } } }),
    prisma.medicalReport.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.medicalReport.groupBy({ by: ['reportTypePrimary'], _count: { _all: true } }),
    prisma.medicalReport.aggregate({
      _sum: { testCount: true, needsReviewCount: true },
      _avg: { processingMs: true, testCount: true },
    }),
    prisma.reportCorrection.count({ where: { createdAt: { gte: since } } }),
    prisma.reportShare.count({ where: { createdAt: { gte: since } } }),
    prisma.reportAuditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      where: { createdAt: { gte: since } },
    }),
    prisma.$queryRaw<{ month: Date; count: number }[]>`
      SELECT date_trunc('month', "createdAt")::timestamp AS month, COUNT(*)::int AS count
      FROM "medical_reports"
      WHERE "createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  ]);

  const distinctPatients = await prisma.medicalReport.findMany({
    distinct: ['patientId'],
    select: { patientId: true },
    where: { createdAt: { gte: since } },
  });

  const totalTests = usage._sum.testCount ?? 0;
  const needsReview = usage._sum.needsReviewCount ?? 0;

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    reports: {
      total: totalReports,
      inWindow: recentReports,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      byReportType: Object.fromEntries(
        byType.map((row) => [row.reportTypePrimary ?? 'unknown', row._count._all])
      ),
      monthly: monthlyRaw.map((row) => ({
        month: row.month instanceof Date ? row.month.toISOString().slice(0, 7) : String(row.month).slice(0, 7),
        count: Number(row.count),
      })),
    },
    usage: {
      totalTests,
      needsReviewTests: needsReview,
      needsReviewShare: totalTests > 0 ? Number((needsReview / totalTests).toFixed(3)) : 0,
      averageProcessingMs: usage._avg.processingMs ? Math.round(usage._avg.processingMs) : null,
      averageTestsPerReport: usage._avg.testCount
        ? Number(usage._avg.testCount.toFixed(1))
        : 0,
    },
    privacy: {
      distinctPatientsInWindow: suppress(distinctPatients.length),
      minimumBucket: MIN_BUCKET,
      suppressedBuckets: Object.fromEntries(
        byType
          .filter((row) => row._count._all > 0 && row._count._all < MIN_BUCKET)
          .map((row) => [row.reportTypePrimary ?? 'unknown', 'suppressed'])
      ),
    },
    activity: {
      correctionsInWindow: corrections,
      sharesInWindow: shares,
      auditEvents: Object.fromEntries(
        auditByAction.map((row) => [row.action, row._count._all])
      ),
    },
    notice:
      'Aggregate figures only. Administrators cannot open, search or export an individual medical report.',
  };
}
