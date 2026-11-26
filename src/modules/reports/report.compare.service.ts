/**
 * Comparison of two or more reports for the same patient.
 *
 * Compatibility is decided from the reports themselves:
 *  - the printed report date (never the upload date),
 *  - the same canonical test,
 *  - the same normalised unit,
 *  - a numeric value that can be ordered.
 *
 * Anything that cannot be compared is reported as excluded, with a reason.
 */
import type { MedicalReportTest } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { JwtPayload } from '../../utils/jwt';
import { loadReportForUser } from './report.access';
import { auditDetail, writeAudit } from './report.audit.service';

const DAY_MS = 24 * 60 * 60 * 1000;

interface LoadedReport {
  id: string;
  reportDate: Date;
  reportType: string | null;
  tests: MedicalReportTest[];
}

const dayCount = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / DAY_MS);

export async function compareReports(
  user: JwtPayload,
  reportIds: string[],
  requestId?: string
) {
  const ids = [...new Set(reportIds.filter((id) => typeof id === 'string' && id.length > 0))];
  if (ids.length < 2) throw new AppError('Select at least two reports to compare.', 422);
  if (ids.length > 5) throw new AppError('At most five reports can be compared at once.', 422);

  const loaded: LoadedReport[] = [];
  const patientIds = new Set<string>();
  for (const id of ids) {
    const { report } = await loadReportForUser(user, id, 'view');
    patientIds.add(report.patientId);
    if (report.status !== 'COMPLETED') {
      throw new AppError('Only processed reports can be compared.', 409);
    }
    if (!report.reportDate) {
      throw new AppError(
        'Every report needs the date printed on it before it can be compared. Add the report date and try again.',
        422
      );
    }
    loaded.push({
      id: report.id,
      reportDate: report.reportDate,
      reportType: report.reportTypePrimary,
      tests: await prisma.medicalReportTest.findMany({ where: { reportId: report.id } }),
    });
  }

  if (patientIds.size !== 1) {
    throw new AppError('Reports from different patients cannot be compared.', 422);
  }

  loaded.sort((a, b) => a.reportDate.getTime() - b.reportDate.getTime());
  const firstDate = loaded[0]?.reportDate ?? new Date();
  const lastDate = loaded[loaded.length - 1]?.reportDate ?? firstDate;

  const canonicalIds = new Map<string, string>();
  for (const report of loaded) {
    for (const test of report.tests) {
      if (test.canonicalId) canonicalIds.set(test.canonicalId, test.canonicalName);
    }
  }

  const comparisons: Record<string, unknown>[] = [];
  const excluded: { test: string; reason: string }[] = [];

  for (const [canonicalId, name] of canonicalIds) {
    const series = loaded.map((report) => {
      const test = report.tests.find((item) => item.canonicalId === canonicalId);
      return { report, test };
    });

    const present = series.filter((item) => item.test);
    if (present.length < 2) {
      excluded.push({ test: name, reason: 'present_in_only_one_report' });
      continue;
    }
    if (present.length < loaded.length) {
      excluded.push({ test: name, reason: 'missing_from_some_reports' });
      continue;
    }

    const units = new Set(present.map((item) => item.test?.unitNormalized ?? ''));
    if (!present.every((item) => item.test?.unitKnown) || units.size !== 1) {
      excluded.push({ test: name, reason: 'incompatible_or_unknown_unit' });
      continue;
    }
    if (!present.every((item) => typeof item.test?.valueNumeric === 'number')) {
      excluded.push({ test: name, reason: 'non_numeric_value' });
      continue;
    }

    const points = present.map((item) => ({
      reportId: item.report.id,
      reportDate: item.report.reportDate,
      value: item.test?.valueNumeric ?? null,
      unit: item.test?.unitNormalized ?? null,
      status: item.test?.status ?? 'UNKNOWN',
    }));

    const firstValue = points[0]?.value ?? null;
    const lastValue = points[points.length - 1]?.value ?? null;
    const change =
      firstValue !== null && lastValue !== null ? Number((lastValue - firstValue).toFixed(4)) : null;

    comparisons.push({
      test: name,
      canonicalId,
      unit: points[0]?.unit ?? null,
      category: present[0]?.test?.category ?? null,
      comparable: true,
      direction: change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      change,
      daysBetween: dayCount(firstDate, lastDate),
      points,
    });
  }

  await writeAudit({
    action: 'COMPARE',
    reportRef: loaded[0]?.id ?? null,
    actor: user,
    detail: auditDetail({ reports: loaded.length, compared: comparisons.length }),
    ...(requestId ? { requestId } : {}),
  });

  return {
    patientId: [...patientIds][0],
    reports: loaded.map((report) => ({
      id: report.id,
      reportDate: report.reportDate,
      reportType: report.reportType,
    })),
    orderedBy: 'reportDate',
    comparisons,
    excluded,
    note:
      'Differences between printed results are shown for information only. They are not a diagnosis and do not replace advice from your doctor.',
  };
}

export async function comparePatientHistory(
  user: JwtPayload,
  patientId: string,
  canonicalId: string,
  requestId?: string
) {
  const reports = await prisma.medicalReport.findMany({
    where: {
      patientId,
      status: 'COMPLETED',
      reportDate: { not: null },
      tests: { some: { canonicalId } },
    },
    orderBy: { reportDate: 'asc' },
    take: 10,
    select: { id: true },
  });

  if (reports.length < 2) {
    throw new AppError('At least two dated reports with this test are needed.', 422);
  }

  return compareReports(user, reports.map((item) => item.id), requestId);
}
