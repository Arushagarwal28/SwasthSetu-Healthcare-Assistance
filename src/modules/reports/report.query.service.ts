/**
 * Report history: scoped listing, search, filtering and pagination.
 *
 * The visibility filter always comes from `visibleReportWhere`, so a filter
 * sent by the caller can never widen what they are allowed to see.
 */
import type { Prisma, ReportProcessingStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { JwtPayload } from '../../utils/jwt';
import { visibleReportWhere } from './report.access';
import { toSummaryDto } from './report.mapper';

const MAX_PAGE_SIZE = 50;

export interface ReportListFilters {
  q?: string | undefined;
  status?: string | undefined;
  reportType?: string | undefined;
  patientId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  needsReview?: boolean | undefined;
  sort?: 'date' | 'uploaded' | undefined;
  order?: 'asc' | 'desc' | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

const STATUSES = new Set([
  'UPLOADED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

function dateBound(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${label} must be a valid date.`, 422);
  }
  return date;
}

export async function listReports(user: JwtPayload, filters: ReportListFilters) {
  const visibility = await visibleReportWhere(user);
  const and: Prisma.MedicalReportWhereInput[] = [visibility];

  if (filters.status) {
    if (!STATUSES.has(filters.status)) {
      throw new AppError('Invalid status filter.', 422);
    }
    and.push({ status: filters.status as ReportProcessingStatus });
  }
  if (filters.reportType) {
    and.push({ reportTypePrimary: filters.reportType });
  }
  if (filters.patientId) {
    and.push({ patientId: filters.patientId });
  }
  if (filters.needsReview !== undefined) {
    and.push(filters.needsReview ? { needsReviewCount: { gt: 0 } } : { needsReviewCount: 0 });
  }

  const from = dateBound(filters.from, 'from');
  const to = dateBound(filters.to, 'to');
  if (from || to) {
    and.push({
      reportDate: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    });
  }

  if (filters.q && filters.q.trim().length > 0) {
    const term = filters.q.trim().slice(0, 80);
    and.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { reportTypePrimary: { contains: term, mode: 'insensitive' } },
        { patient: { fullName: { contains: term, mode: 'insensitive' } } },
        { tests: { some: { canonicalName: { contains: term, mode: 'insensitive' } } } },
      ],
    });
  }

  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(filters.pageSize ?? 20)));
  const order = filters.order === 'asc' ? 'asc' : 'desc';
  const sortField = filters.sort === 'date' ? 'reportDate' : 'createdAt';

  const where: Prisma.MedicalReportWhereInput = { AND: and };

  const [total, rows] = await Promise.all([
    prisma.medicalReport.count({ where }),
    prisma.medicalReport.findMany({
      where,
      include: { patient: { select: { fullName: true } } },
      orderBy:
        sortField === 'reportDate'
          ? [{ reportDate: { sort: order, nulls: 'last' } }, { createdAt: order }]
          : [{ createdAt: order }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toSummaryDto),
    pagination: {
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
