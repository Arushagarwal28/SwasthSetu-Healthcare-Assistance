/**
 * Authorization for medical reports.
 *
 * Rules:
 *  - PATIENT        own reports only (via `Patient.userId`)
 *  - HELPER         reports of patients they are linked to in `PatientHelperLink`
 *  - HOSPITAL_STAFF reports explicitly shared with them (active `ReportShare`)
 *  - ADMIN          never an individual report; aggregates only
 *
 * Every read and write goes through these helpers so a new endpoint cannot
 * accidentally skip a check.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { canHelperAccessPatient } from '../helpers/helper.service';
import type { JwtPayload } from '../../utils/jwt';

export type AccessLevel = 'view' | 'manage';

export interface ReportContext {
  report: Prisma.MedicalReportGetPayload<{
    include: {
      patient: { select: { id: true; userId: true; fullName: true } };
      shares: { include: { user: { select: { email: true } } } };
    };
  }>;
  via: 'owner' | 'helper' | 'share';
}

const roleOf = (user: JwtPayload): string => user.role;

export function denyAdmin(user: JwtPayload): void {
  if (roleOf(user) === 'ADMIN') {
    throw new AppError('Administrators cannot access individual medical reports.', 403);
  }
}

/** Active share = not revoked and not expired. */
function activeShareWhere(userId: string): Prisma.ReportShareWhereInput {
  return {
    userId,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

/** Can this user upload or manage a report for this patient? */
export async function assertPatientAccess(
  user: JwtPayload,
  patientId: string
): Promise<void> {
  denyAdmin(user);

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, userId: true },
  });
  if (!patient) throw new AppError('Patient not found', 404);

  if (roleOf(user) === 'PATIENT') {
    if (patient.userId !== user.userId) {
      throw new AppError('You do not have permission to act for this patient.', 403);
    }
    return;
  }

  if (roleOf(user) === 'HELPER') {
    if (!(await canHelperAccessPatient(user.userId, patientId))) {
      throw new AppError('This patient is not linked to your helper account.', 403);
    }
    return;
  }

  throw new AppError('You do not have permission to act for this patient.', 403);
}

/**
 * Load a report and assert the caller may use it.
 *
 * `manage` additionally requires ownership (patient or an authorized helper):
 * hospital staff can read a shared report but never correct or delete it.
 */
export async function loadReportForUser(
  user: JwtPayload,
  reportId: string,
  level: AccessLevel
): Promise<ReportContext> {
  denyAdmin(user);

  const report = await prisma.medicalReport.findUnique({
    where: { id: reportId },
    include: {
      patient: { select: { id: true, userId: true, fullName: true } },
      shares: { include: { user: { select: { email: true } } } },
    },
  });
  if (!report) throw new AppError('Medical report not found', 404);

  const role = roleOf(user);

  if (role === 'PATIENT' && report.patient.userId === user.userId) {
    return { report, via: 'owner' };
  }

  if (role === 'HELPER' && (await canHelperAccessPatient(user.userId, report.patientId))) {
    return { report, via: 'helper' };
  }

  if (role === 'HOSPITAL_STAFF' && level === 'view') {
    const share = report.shares.find(
      (item) =>
        item.userId === user.userId &&
        item.revokedAt === null &&
        (item.expiresAt === null || item.expiresAt.getTime() > Date.now())
    );
    if (share) return { report, via: 'share' };
  }

  // Same answer for "does not exist" and "not yours", so ids cannot be probed.
  throw new AppError('Medical report not found', 404);
}

/** Prisma filter restricting the report list to what the caller may see. */
export async function visibleReportWhere(user: JwtPayload): Promise<Prisma.MedicalReportWhereInput> {
  denyAdmin(user);
  const role = roleOf(user);

  if (role === 'PATIENT') {
    return { patient: { userId: user.userId } };
  }

  if (role === 'HELPER') {
    return { patient: { helperLinks: { some: { helper: { userId: user.userId } } } } };
  }

  if (role === 'HOSPITAL_STAFF') {
    return { shares: { some: activeShareWhere(user.userId) } };
  }

  throw new AppError('You do not have permission to list medical reports.', 403);
}

/** Patient ids the caller may upload for (used by the upload endpoint). */
export async function visiblePatientIds(user: JwtPayload): Promise<string[]> {
  denyAdmin(user);
  const role = roleOf(user);

  if (role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({
      where: { userId: user.userId },
      select: { id: true },
    });
    return patient ? [patient.id] : [];
  }

  if (role === 'HELPER') {
    const links = await prisma.patientHelperLink.findMany({
      where: { helper: { userId: user.userId } },
      select: { patientId: true },
    });
    return links.map((link) => link.patientId);
  }

  return [];
}

/** Reusable "can share" rule: only the patient owner or a linked helper. */
export function canShare(context: ReportContext): boolean {
  return context.via === 'owner' || context.via === 'helper';
}
