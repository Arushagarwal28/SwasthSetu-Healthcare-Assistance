/**
 * Manual verification and correction.
 *
 * A correction never overwrites the extracted value: the Python service returns
 * both the original and the corrected reading, and the status is recomputed
 * deterministically from the corrected value and the printed range. The whole
 * report's bilingual explanations are then regenerated.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { JwtPayload } from '../../utils/jwt';
import { loadReportForUser } from './report.access';
import { auditDetail, writeAudit } from './report.audit.service';
import {
  explanationRows,
  payloadFromStored,
  testColumns,
  toDetailDto,
} from './report.mapper';
import { correctParsedReport } from './report.python';
import { CORRECTION_FIELDS, type CorrectionField, type CorrectionRequestItem } from './report.types';

const asJson = (value: unknown): Prisma.InputJsonValue | Prisma.JsonNullValueInput =>
  value === null || value === undefined ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

/** API field names are lowercase; the database enum is uppercase. */
const DB_FIELD: Record<CorrectionField, 'VALUE' | 'UNIT' | 'REFERENCE_RANGE' | 'NAME'> = {
  value: 'VALUE',
  unit: 'UNIT',
  reference_range: 'REFERENCE_RANGE',
  name: 'NAME',
};

export async function correctReport(
  user: JwtPayload,
  reportId: string,
  items: CorrectionRequestItem[],
  requestId?: string
) {
  await loadReportForUser(user, reportId, 'manage');

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('At least one correction is required.', 422);
  }
  if (items.length > 20) {
    throw new AppError('At most 20 corrections can be applied at once.', 422);
  }

  const report = await prisma.medicalReport.findUnique({
    where: { id: reportId },
    include: { tests: true },
  });
  if (!report) throw new AppError('Medical report not found', 404);
  if (report.status !== 'COMPLETED') {
    throw new AppError('Only a processed report can be corrected.', 409);
  }

  const byId = new Map(report.tests.map((test) => [test.id, test]));
  const noteByIndex = new Map<number, string | null>();

  const corrections = items.map((item) => {
    const row = byId.get(item.testId);
    if (!row) throw new AppError('A result in this report could not be found.', 422);
    if (!CORRECTION_FIELDS.includes(item.field)) {
      throw new AppError('Unsupported correction field.', 422);
    }
    const corrected = typeof item.corrected === 'number' ? item.corrected : String(item.corrected ?? '').trim();
    if (corrected === '') throw new AppError('A corrected value is required.', 422);
    noteByIndex.set(row.index, item.note?.slice(0, 300) ?? null);
    return {
      index: row.index,
      field: item.field as CorrectionField,
      corrected,
      correctedBy: user.userId,
      correctedAt: new Date().toISOString(),
      note: item.note?.slice(0, 300) ?? null,
      canonicalId: row.canonicalId,
    };
  });

  const payload = payloadFromStored(report, report.tests);
  const result = await correctParsedReport(payload, corrections);

  if (result.applied_count === 0) {
    throw new AppError(
      result.warnings[0] ?? 'The correction could not be applied to this result.',
      422
    );
  }

  const updatedTests = result.tests;
  const byIndex = new Map(updatedTests.map((test) => [test.index, test]));
  const correctedIndexes = new Set(result.applied.map((item) => item.index));
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const test of updatedTests) {
      const existing = report.tests.find((row) => row.index === test.index);
      if (!existing) continue;
      const { reportId: _reportId, index: _index, ...columns } = testColumns(reportId, test);
      const wasCorrected = correctedIndexes.has(test.index);
      await tx.medicalReportTest.update({
        where: { id: existing.id },
        data: {
          ...columns,
          correctedAt: wasCorrected ? now : existing.correctedAt,
          correctedById: wasCorrected ? user.userId : existing.correctedById,
        },
      });
    }

    for (const applied of result.applied) {
      const testRow = report.tests.find((row) => row.index === applied.index);
      if (!testRow) continue;
      const updated = byIndex.get(applied.index);
      await tx.reportCorrection.create({
        data: {
          reportId,
          testId: testRow.id,
          field: DB_FIELD[applied.field as CorrectionField] ?? 'VALUE',
          originalValue: asJson(applied.original),
          correctedValue: asJson(applied.corrected),
          correctedById: user.userId,
          note: noteByIndex.get(applied.index) ?? null,
          resultingStatus: updated?.status ?? null,
        },
      });
    }

    await tx.reportExplanation.deleteMany({ where: { reportId } });
    const stored = await tx.medicalReportTest.findMany({
      where: { reportId },
      select: { id: true, index: true },
    });
    const testIds = new Map(stored.map((item) => [item.index, item.id]));
    const rows = explanationRows(reportId, result.explanations, testIds);
    if (rows.length > 0) {
      await tx.reportExplanation.createMany({ data: rows });
    }

    const needsReview = updatedTests.filter((test) => test.needs_review).length;
    await tx.medicalReport.update({
      where: { id: reportId },
      data: {
        parsedPayload: { ...payload, tests: updatedTests } as unknown as Prisma.InputJsonValue,
        testCount: updatedTests.length,
        needsReviewCount: needsReview,
        reportTypePrimary: payload.report?.primary ?? report.reportTypePrimary,
        reportTypeDetected: payload.report?.detected ?? report.reportTypeDetected,
        reportTypeMixed: Boolean(payload.report?.mixed ?? report.reportTypeMixed),
      },
    });
  });

  await writeAudit({
    action: 'CORRECT',
    reportId,
    actor: user,
    detail: auditDetail({
      fields: corrections.map((item) => item.field),
      tests: corrections.length,
      applied: result.applied_count,
    }),
    ...(requestId ? { requestId } : {}),
  });

  const detail = await prisma.medicalReport.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      tests: true,
      explanations: true,
      corrections: true,
      shares: { include: { user: { select: { email: true } } } },
      patient: { select: { id: true, fullName: true, userId: true } },
    },
  });

  return toDetailDto(detail);
}
