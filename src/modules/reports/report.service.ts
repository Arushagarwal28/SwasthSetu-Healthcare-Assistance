/**
 * Report lifecycle: upload → parse → explain → store, plus share and delete.
 *
 * The uploaded file only ever lives in memory for the duration of the request;
 * it is forwarded to the Python service and then dropped. Only the parsed,
 * structured result is stored.
 */
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { JwtPayload } from '../../utils/jwt';
import { assertPatientAccess, canShare, loadReportForUser } from './report.access';
import { auditDetail, writeAudit } from './report.audit.service';
import {
  explanationRows,
  payloadFromStored,
  testColumns,
  toDetailDto,
} from './report.mapper';
import {
  explainParsedReport,
  parseDocument,
  ReportServiceError,
} from './report.python';
import { sanitiseFilename, validateUpload } from './report.storage';
import type { ParsedReportPayload } from './report.types';

export interface CreateReportInput {
  user: JwtPayload;
  patientId: string;
  title?: string | undefined;
  reportDate?: string | undefined;
  language?: string | undefined;
  file: Express.Multer.File | undefined;
  requestId?: string | undefined;
}

const EARLIEST_REPORT_DATE = Date.UTC(1900, 0, 1);

function validReportDate(value: Date): boolean {
  const time = value.getTime();
  return Number.isFinite(time) && time >= EARLIEST_REPORT_DATE && time <= Date.now() + 24 * 3600 * 1000;
}

function parseIsoDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('reportDate must be a valid date.', 422);
  }
  if (!validReportDate(date)) {
    throw new AppError('reportDate is outside the accepted range.', 422);
  }
  return date;
}

/**
 * Best-effort extraction of the report's own date from text that the parser
 * could not turn into a test row. Nothing is guessed when no date is printed:
 * comparisons then simply skip this report.
 */
export function extractReportDate(payload: ParsedReportPayload): Date | null {
  const lines = Array.isArray(payload.unparsed_lines) ? payload.unparsed_lines : [];
  const iso = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;
  const dmy = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;

  for (const line of lines) {
    const text = typeof line?.text === 'string' ? line.text : '';
    if (!text || /dob|date of birth|birth|जन्म/i.test(text)) continue;

    const isoMatch = iso.exec(text);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (validReportDate(date)) return date;
    }

    const shortMatch = dmy.exec(text);
    if (shortMatch) {
      const [, first, second, rawYear] = shortMatch;
      if (!first || !second || !rawYear) continue;
      const a = Number(first);
      const b = Number(second);
      // Indian reports print day first; fall back to month first only when the
      // day cannot be first (e.g. 12/25/2026).
      const day = b > 12 ? b : a;
      const month = b > 12 ? a : b;
      let year = Number(rawYear);
      if (rawYear.length === 2) {
        year += year <= new Date().getUTCFullYear() % 100 ? 2000 : 1900;
      }
      const date = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(date.getTime()) && validReportDate(date)) return date;
    }
  }
  return null;
}

const FAILURE_CODES = new Set([
  'report_service_unavailable',
  'report_service_timeout',
  'report_service_rejected',
  'report_service_invalid_response',
]);

async function failReport(reportId: string, code: string, user: JwtPayload, requestId?: string) {
  const errorCode = FAILURE_CODES.has(code) ? code.toUpperCase() : 'PROCESSING_FAILED';
  await prisma.medicalReport.update({
    where: { id: reportId },
    data: { status: 'FAILED', errorCode, processedAt: new Date() },
  });
  await writeAudit({
    action: 'PARSE_FAILURE',
    reportId,
    actor: user,
    detail: auditDetail({ errorCode }),
    ...(requestId ? { requestId } : {}),
  });
}

export async function createReport(input: CreateReportInput) {
  const { user, patientId } = input;
  await assertPatientAccess(user, patientId);

  const upload = validateUpload(input.file);
  const reportDate = parseIsoDate(input.reportDate);

  const report = await prisma.medicalReport.create({
    data: {
      patientId,
      uploadedById: user.userId,
      uploadedByRole: user.role as never,
      title: input.title?.trim().slice(0, 120) || null,
      originalFilename: sanitiseFilename(upload.filename),
      fileMimeType: upload.mimeType,
      fileSizeBytes: upload.sizeBytes,
      language: input.language === 'hi' ? 'hi' : 'en',
      status: 'UPLOADED',
      reportDate,
    },
  });

  await writeAudit({
    action: 'UPLOAD',
    reportId: report.id,
    actor: user,
    detail: auditDetail({ fileType: upload.mimeType, sizeBytes: upload.sizeBytes }),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  });

  await prisma.medicalReport.update({
    where: { id: report.id },
    data: { status: 'PROCESSING' },
  });

  const startedAt = Date.now();
  let parsed: ParsedReportPayload;
  let explanations;
  try {
    parsed = await parseDocument({
      buffer: upload.buffer,
      mimeType: upload.mimeType,
      filename: upload.filename,
      documentId: report.id,
    });
    if (!Array.isArray(parsed.tests)) {
      throw new ReportServiceError(
        'The medical report service returned an unreadable response.',
        502,
        'report_service_invalid_response'
      );
    }
    explanations = await explainParsedReport(parsed);
  } catch (error) {
    const code = error instanceof ReportServiceError ? error.code : 'processing_failed';
    await failReport(report.id, code, user, input.requestId);
    if (error instanceof AppError) throw error;
    throw new AppError('The report could not be processed. Please try again.', 502);
  }

  const resolvedDate = reportDate ?? extractReportDate(parsed);
  const needsReview = parsed.tests.filter((test) => test.needs_review).length;
  const processingMs = Date.now() - startedAt;

  const detail = await prisma.$transaction(async (tx) => {
    const columns = parsed.tests.map((test) => testColumns(report.id, test));
    if (columns.length > 0) {
      await tx.medicalReportTest.createMany({ data: columns });
    }
    const stored = await tx.medicalReportTest.findMany({
      where: { reportId: report.id },
      select: { id: true, index: true },
    });
    const testIds = new Map(stored.map((item) => [item.index, item.id]));

    const rows = explanationRows(report.id, explanations, testIds);
    if (rows.length > 0) {
      await tx.reportExplanation.createMany({ data: rows });
    }

    await tx.medicalReport.update({
      where: { id: report.id },
      data: {
        status: 'COMPLETED',
        errorCode: null,
        reportTypePrimary: parsed.report?.primary ?? null,
        reportTypeDetected: parsed.report?.detected ?? [],
        reportTypeMixed: Boolean(parsed.report?.mixed),
        reportDate: resolvedDate,
        parsedPayload: parsed as unknown as object,
        testCount: parsed.tests.length,
        needsReviewCount: needsReview,
        processingMs,
        processedAt: new Date(),
      },
    });

    return tx.medicalReport.findUniqueOrThrow({
      where: { id: report.id },
      include: {
        tests: true,
        explanations: true,
        corrections: true,
        shares: { include: { user: { select: { email: true } } } },
        patient: { select: { id: true, fullName: true, userId: true } },
      },
    });
  });

  await writeAudit({
    action: 'PARSE_SUCCESS',
    reportId: report.id,
    actor: user,
    detail: auditDetail({
      tests: parsed.tests.length,
      needsReview,
      processingMs,
      reportType: parsed.report?.primary ?? 'other',
    }),
    ...(input.requestId ? { requestId: input.requestId } : {}),
  });

  return toDetailDto(detail);
}

export async function getReport(user: JwtPayload, reportId: string, requestId?: string) {
  const { report } = await loadReportForUser(user, reportId, 'view');

  const full = await prisma.medicalReport.findUniqueOrThrow({
    where: { id: report.id },
    include: {
      tests: true,
      explanations: true,
      corrections: true,
      shares: { include: { user: { select: { email: true } } } },
      patient: { select: { id: true, fullName: true, userId: true } },
    },
  });

  await writeAudit({
    action: 'VIEW',
    reportId: report.id,
    actor: user,
    detail: auditDetail({ via: user.role }),
    ...(requestId ? { requestId } : {}),
  });

  // Hospital staff may read a shared report but never see who else it is shared
  // with, which is not their business and would leak staff emails.
  return toDetailDto(full, { redactShares: user.role === 'HOSPITAL_STAFF' });
}

export async function shareReport(
  user: JwtPayload,
  reportId: string,
  targetUserId: string,
  expiresAt?: string
) {
  const context = await loadReportForUser(user, reportId, 'manage');
  if (!canShare(context)) {
    throw new AppError('Only the patient or an authorized helper can share this report.', 403);
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, isActive: true },
  });
  if (!target || !target.isActive || target.role !== 'HOSPITAL_STAFF') {
    throw new AppError('Reports can only be shared with an active hospital staff account.', 422);
  }

  const expiry = expiresAt ? new Date(expiresAt) : null;
  if (expiry && (Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now())) {
    throw new AppError('expiresAt must be a future date.', 422);
  }

  const share = await prisma.reportShare.upsert({
    where: { reportId_userId: { reportId, userId: targetUserId } },
    create: {
      reportId,
      userId: targetUserId,
      grantedById: user.userId,
      expiresAt: expiry,
    },
    update: { revokedAt: null, expiresAt: expiry, grantedById: user.userId },
  });

  await writeAudit({
    action: 'SHARE',
    reportId,
    actor: user,
    detail: auditDetail({ sharedWith: targetUserId, expires: expiry ? 'yes' : 'no' }),
  });

  return {
    userId: share.userId,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt,
  };
}

export async function revokeShare(user: JwtPayload, reportId: string, targetUserId: string) {
  const context = await loadReportForUser(user, reportId, 'manage');
  if (!canShare(context)) {
    throw new AppError('Only the patient or an authorized helper can change sharing.', 403);
  }

  const existing = await prisma.reportShare.findUnique({
    where: { reportId_userId: { reportId, userId: targetUserId } },
  });
  if (!existing || existing.revokedAt) {
    throw new AppError('This report is not shared with that user.', 404);
  }

  const share = await prisma.reportShare.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  await writeAudit({
    action: 'REVOKE_SHARE',
    reportId,
    actor: user,
    detail: auditDetail({ sharedWith: targetUserId }),
  });

  return { userId: share.userId, revokedAt: share.revokedAt };
}

/**
 * Delete a report and everything derived from it.
 *
 * The audit entry is written first, inside the same transaction, and keeps a
 * copy of the report id so deletion is still traceable after the cascade.
 */
export async function deleteReport(user: JwtPayload, reportId: string, requestId?: string) {
  await loadReportForUser(user, reportId, 'manage');

  await prisma.$transaction([
    prisma.reportAuditLog.create({
      data: {
        action: 'DELETE',
        reportRef: reportId,
        actorId: user.userId,
        actorRole: user.role as never,
        detail: auditDetail({ deleted: true }),
        requestId: requestId ?? null,
      },
    }),
    prisma.medicalReport.delete({ where: { id: reportId } }),
  ]);

  return { id: reportId, deleted: true };
}

/** Reusable payload for the correction service. */
export async function loadPayloadForCorrection(reportId: string) {
  const full = await prisma.medicalReport.findUnique({
    where: { id: reportId },
    include: { tests: true },
  });
  if (!full) throw new AppError('Medical report not found', 404);
  return { report: full, payload: payloadFromStored(full, full.tests), tests: full.tests };
}
