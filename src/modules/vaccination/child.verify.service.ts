import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { getActiveFacilityIds, getActiveGrants } from './child.access';
import type { Actor } from './child.access';
import { formatRecordNumber, INDIAN_MOBILE, normalizeIndianMobile, parseRecordNumber, toYmd, ymdToDate } from './child.utils';
import { isValidYmd } from './vaccination.dates';

/**
 * Every mismatch returns the same message: the response must never reveal which
 * of the three identity fields was wrong, or whether the child exists at all.
 */
export const VERIFICATION_FAILED = 'These details do not match any child record.';

export const DEFAULT_GRANT_HOURS = 8;
const MAX_GRANT_HOURS = 72;

export const grantHours = (): number => {
  const configured = Number(process.env.CHILD_ACCESS_GRANT_HOURS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_GRANT_HOURS;
  return Math.min(Math.max(Math.trunc(configured), 1), MAX_GRANT_HOURS);
};

export const grantExpiry = (now: Date = new Date()): Date =>
  new Date(now.getTime() + grantHours() * 60 * 60 * 1000);

export interface VerifyChildInput {
  recordNumber: string;
  guardianMobile: string;
  dateOfBirth: string;
  guardianConsentConfirmed: boolean;
  /** Required when the staff member is linked to more than one active facility. */
  facilityId?: string | null;
}

export interface LastVaccination {
  administeredOn: string;
  /** Null when the administering facility was not recorded. */
  facility: { id: string; name: string } | null;
}

export interface VerifiedChildSummary {
  id: string;
  recordNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  village: string;
  district: string;
  /** The most recent recorded vaccination, not a registration facility. */
  lastVaccination: LastVaccination | null;
}

const audit = async (values: {
  childId?: string | null;
  actorId: string;
  facilityId?: string | null;
  action: 'VERIFICATION_SUCCEEDED' | 'VERIFICATION_FAILED' | 'GRANT_EXTENDED';
  detail?: Prisma.InputJsonValue;
}): Promise<void> => {
  await prisma.childAccessAudit.create({
    data: {
      childId: values.childId ?? null,
      actorId: values.actorId,
      facilityId: values.facilityId ?? null,
      action: values.action,
      ...(values.detail === undefined ? {} : { detail: values.detail }),
    },
  });
};

/** The latest administration for one child, with its verified facility if known. */
export const lastVaccinationFor = async (childId: string): Promise<LastVaccination | null> => {
  const row = await prisma.childDose.findFirst({
    where: { childId, recordedStatus: 'ADMINISTERED', administeredOn: { not: null } },
    orderBy: { administeredOn: 'desc' },
    select: {
      administeredOn: true,
      administeredFacility: { select: { id: true, name: true } },
    },
  });
  if (!row || !row.administeredOn) return null;
  return { administeredOn: toYmd(row.administeredOn), facility: row.administeredFacility };
};

/** The same information for several children, in one query (grant list). */
export const lastVaccinationsFor = async (childIds: string[]): Promise<Map<string, LastVaccination>> => {
  if (childIds.length === 0) return new Map();
  const rows = await prisma.childDose.findMany({
    where: { childId: { in: childIds }, recordedStatus: 'ADMINISTERED', administeredOn: { not: null } },
    orderBy: { administeredOn: 'desc' },
    select: {
      childId: true,
      administeredOn: true,
      administeredFacility: { select: { id: true, name: true } },
    },
  });

  const map = new Map<string, LastVaccination>();
  for (const row of rows) {
    if (map.has(row.childId) || !row.administeredOn) continue;
    map.set(row.childId, {
      administeredOn: toYmd(row.administeredOn),
      facility: row.administeredFacility,
    });
  }
  return map;
};

/**
 * Manual identity matching (record number + registered guardian mobile + date of
 * birth) followed by a staff attestation that the guardian gave permission.
 * This is not proof of guardianship; the attestation is recorded as such.
 *
 * The grant is issued at the facility where the encounter is happening. A staff
 * member linked to several active facilities must choose one explicitly.
 */
export const verifyChildAccess = async (actor: Actor, input: VerifyChildInput) => {
  if (actor.role !== 'HOSPITAL_STAFF') {
    throw new AppError('Only hospital staff can verify a child for cross-facility access', 403);
  }

  if (input.guardianConsentConfirmed !== true) {
    // Not an identity failure: the staff member has not attested permission yet.
    throw new AppError('Confirm that the child’s identity was checked and guardian permission was obtained', 400);
  }

  const activeFacilityIds = await getActiveFacilityIds(actor);
  if (activeFacilityIds.length === 0) {
    throw new AppError('Your account is not linked to an active facility', 403);
  }

  const requested = input.facilityId ?? null;
  if (requested !== null && !activeFacilityIds.includes(requested)) {
    throw new AppError('Choose an active facility you are linked to', 403);
  }
  if (requested === null && activeFacilityIds.length > 1) {
    throw new AppError(
      'You are linked to more than one facility. Choose the facility where you are seeing this child (facilityId).',
      400
    );
  }
  const facilityId = requested ?? activeFacilityIds[0]!;

  const recordNumber = parseRecordNumber(input.recordNumber);
  const guardianMobile = normalizeIndianMobile(input.guardianMobile);
  const dob = String(input.dateOfBirth ?? '');

  if (!recordNumber || !isValidYmd(dob) || !INDIAN_MOBILE.test(guardianMobile)) {
    await audit({ actorId: actor.userId, facilityId, action: 'VERIFICATION_FAILED' });
    throw new AppError(VERIFICATION_FAILED, 404);
  }

  // One query: all three fields must match the same child. The child's name is
  // never used for matching, and no details are returned before this succeeds.
  const child = await prisma.child.findFirst({
    where: {
      recordNumber,
      dateOfBirth: ymdToDate(dob),
      OR: [{ primaryMobile: guardianMobile }, { alternateMobile: guardianMobile }],
    },
    select: {
      id: true,
      recordNumber: true,
      fullName: true,
      dateOfBirth: true,
      gender: true,
      village: true,
      district: true,
    },
  });

  if (!child) {
    await audit({ actorId: actor.userId, facilityId, action: 'VERIFICATION_FAILED' });
    throw new AppError(VERIFICATION_FAILED, 404);
  }

  const expiresAt = grantExpiry();

  const grant = await prisma.$transaction(async (tx) => {
    const existing = await tx.childAccessGrant.findUnique({
      where: { childId_userId: { childId: child.id, userId: actor.userId } },
      select: { id: true },
    });

    const saved = await tx.childAccessGrant.upsert({
      where: { childId_userId: { childId: child.id, userId: actor.userId } },
      create: {
        childId: child.id,
        userId: actor.userId,
        facilityId,
        verificationMethod: 'MANUAL_ATTESTED',
        expiresAt,
      },
      update: {
        facilityId,
        verificationMethod: 'MANUAL_ATTESTED',
        expiresAt,
        revokedAt: null,
        grantedAt: new Date(),
      },
      select: { expiresAt: true, verificationMethod: true },
    });

    await tx.childAccessAudit.create({
      data: {
        childId: child.id,
        actorId: actor.userId,
        facilityId,
        action: existing ? 'GRANT_EXTENDED' : 'VERIFICATION_SUCCEEDED',
        // Timing only: no mobile number, date of birth or other submitted value.
        detail: { expiresAt: saved.expiresAt.toISOString() },
      },
    });

    return saved;
  });

  const summary: VerifiedChildSummary = {
    id: child.id,
    recordNumber: formatRecordNumber(child.recordNumber),
    fullName: child.fullName,
    dateOfBirth: toYmd(child.dateOfBirth),
    gender: child.gender,
    village: child.village,
    district: child.district,
    lastVaccination: await lastVaccinationFor(child.id),
  };

  return {
    child: summary,
    access: {
      verificationMethod: grant.verificationMethod,
      expiresAt: grant.expiresAt,
      facility: { id: facilityId },
    },
  };
};

/** The staff member's live temporary grants, for the dashboard. */
export const listVerifiedAccess = async (actor: Actor) => {
  if (actor.role !== 'HOSPITAL_STAFF') {
    throw new AppError('Only hospital staff can have temporary child access', 403);
  }
  const grants = await getActiveGrants(actor);
  if (grants.length === 0) return [];

  const children = await prisma.child.findMany({
    where: { id: { in: grants.map((g) => g.childId) } },
    select: { id: true, recordNumber: true, fullName: true, dateOfBirth: true },
  });
  const byId = new Map(children.map((c) => [c.id, c]));
  const lastVaccinations = await lastVaccinationsFor(children.map((c) => c.id));

  return grants
    .map((grant) => {
      const child = byId.get(grant.childId);
      if (!child) return null;
      return {
        childId: child.id,
        recordNumber: formatRecordNumber(child.recordNumber),
        fullName: child.fullName,
        dateOfBirth: toYmd(child.dateOfBirth),
        lastVaccination: lastVaccinations.get(child.id) ?? null,
        grantedAt: grant.grantedAt,
        expiresAt: grant.expiresAt,
        accessFacilityId: grant.facilityId,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
};
