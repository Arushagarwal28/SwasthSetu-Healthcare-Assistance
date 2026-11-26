/**
 * Directory lookups used by the sharing dialog and the history filters.
 *
 * Two rules keep these endpoints from becoming a directory dump:
 *  - only the roles that may share a report (PATIENT, HELPER) can search staff;
 *  - a search needs at least two characters, is paginated and is rate limited
 *    at the route, so accounts cannot be enumerated page by page.
 *
 * Nothing beyond what the picker needs is returned: an account id, its sign-in
 * email (the only identifier a hospital staff account has) and the facilities
 * the account is attached to.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import type { JwtPayload } from '../../utils/jwt';
import { visibleReportWhere } from './report.access';

const STAFF_PAGE_SIZE = 8;
const MAX_STAFF_PAGE_SIZE = 10;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 80;

export interface StaffSearchFilters {
  q?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface StaffTarget {
  userId: string;
  email: string;
  facilities: { id: string; name: string; type: string }[];
}

/**
 * Hospital staff accounts that can be given read-only access to a report.
 *
 * Only active HOSPITAL_STAFF accounts are listed; administrators, helpers and
 * other patients never appear, and no patient data is touched.
 */
export async function searchShareTargets(user: JwtPayload, filters: StaffSearchFilters) {
  if (user.role !== 'PATIENT' && user.role !== 'HELPER') {
    throw new AppError('Only a patient or an authorized helper can share a report.', 403);
  }

  const term = (filters.q ?? '').trim().slice(0, MAX_QUERY_LENGTH);
  if (term.length < MIN_QUERY_LENGTH) {
    throw new AppError(
      `Type at least ${MIN_QUERY_LENGTH} characters of the staff email or facility name.`,
      422
    );
  }

  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(
    MAX_STAFF_PAGE_SIZE,
    Math.max(1, Math.trunc(filters.pageSize ?? STAFF_PAGE_SIZE))
  );

  const where: Prisma.UserWhereInput = {
    role: 'HOSPITAL_STAFF',
    isActive: true,
    OR: [
      { email: { contains: term, mode: 'insensitive' } },
      { hospitalStaffLinks: { some: { facility: { name: { contains: term, mode: 'insensitive' } } } } },
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { email: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        hospitalStaffLinks: {
          select: { facility: { select: { id: true, name: true, type: true } } },
        },
      },
    }),
  ]);

  const items: StaffTarget[] = rows.map((row) => ({
    userId: row.id,
    email: row.email,
    facilities: row.hospitalStaffLinks.map((link) => ({
      id: link.facility.id,
      name: link.facility.name,
      type: link.facility.type,
    })),
  }));

  return {
    items,
    pagination: {
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

/**
 * Report types that actually occur in the reports this user may see.
 *
 * This replaces the old UI shortcut of reading the first page of the history:
 * the filter is complete even when a patient has hundreds of reports, and it
 * can never advertise a type from another patient's report.
 */
export async function reportTypeOptions(user: JwtPayload) {
  const visibility = await visibleReportWhere(user);

  const rows = await prisma.medicalReport.groupBy({
    by: ['reportTypePrimary'],
    where: { AND: [visibility, { reportTypePrimary: { not: null } }] },
    _count: { _all: true },
  });

  return rows
    .filter((row): row is typeof row & { reportTypePrimary: string } => Boolean(row.reportTypePrimary))
    .map((row) => ({ value: row.reportTypePrimary, reportCount: row._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value));
}
