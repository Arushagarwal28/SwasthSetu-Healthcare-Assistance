import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

export interface Actor {
  userId: string;
  role: string;
}

/**
 * OWN      - a helper's own registration (unchanged).
 * VERIFIED - a live, facility-issued temporary grant.
 * NONE     - no access.
 *
 * There is deliberately no FACILITY type: a child no longer belongs to a
 * facility, so being linked to a facility grants no standing access.
 */
export type ChildAccessType = 'OWN' | 'VERIFIED' | 'NONE';

export interface ChildAccess {
  accessType: ChildAccessType;
  /** Set only for VERIFIED access. */
  accessExpiresAt: Date | null;
}

/** Facilities this user is linked to (hospital staff links, or a helper's facility links). */
export const getLinkedFacilityIds = async (actor: Actor): Promise<string[]> => {
  if (actor.role === 'HOSPITAL_STAFF') {
    const links = await prisma.hospitalStaffFacilityLink.findMany({
      where: { userId: actor.userId },
      select: { facilityId: true },
    });
    return links.map((l) => l.facilityId);
  }
  if (actor.role === 'HELPER') {
    const helper = await prisma.helperProfile.findUnique({
      where: { userId: actor.userId },
      select: { facilityLinks: { select: { facilityId: true } } },
    });
    return helper?.facilityLinks.map((l) => l.facilityId) ?? [];
  }
  return [];
};

/**
 * Live cross-facility grants for this staff member. A grant stops counting when
 * it expires, when the facility it was issued at is deactivated, or when the
 * staff member is no longer linked to that facility.
 */
export const getActiveGrants = async (actor: Actor) => {
  if (actor.role !== 'HOSPITAL_STAFF') return [];
  return prisma.childAccessGrant.findMany({
    where: {
      userId: actor.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      facility: { isActive: true, hospitalStaffLinks: { some: { userId: actor.userId } } },
    },
    select: { childId: true, facilityId: true, expiresAt: true, grantedAt: true },
    orderBy: { expiresAt: 'desc' },
  });
};

export const getActiveGrantForChild = async (actor: Actor, childId: string) => {
  if (actor.role !== 'HOSPITAL_STAFF') return null;
  return prisma.childAccessGrant.findFirst({
    where: {
      childId,
      userId: actor.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      facility: { isActive: true, hospitalStaffLinks: { some: { userId: actor.userId } } },
    },
    select: { id: true, facilityId: true, expiresAt: true },
  });
};

/** A staff member needs at least one active facility to verify a child. */
export const getActiveFacilityIds = async (actor: Actor): Promise<string[]> => {
  if (actor.role !== 'HOSPITAL_STAFF') return [];
  const links = await prisma.hospitalStaffFacilityLink.findMany({
    where: { userId: actor.userId, facility: { isActive: true } },
    select: { facilityId: true },
    orderBy: { createdAt: 'asc' },
  });
  return links.map((l) => l.facilityId);
};

/**
 * Which children a user may see, as a Prisma filter:
 *  - HELPER:         children they registered themselves
 *  - HOSPITAL_STAFF: only children covered by a live temporary grant they hold.
 *                    There is no standing facility scope and no registry browsing.
 *  - everyone else (including ADMIN): none. Children's records are personal
 *    medical data; admin gets aggregate statistics, not individual records.
 */
export const childAccessFilter = async (actor: Actor): Promise<Prisma.ChildWhereInput> => {
  if (actor.role === 'HELPER') return { registeredById: actor.userId };
  if (actor.role === 'HOSPITAL_STAFF') {
    const grants = await getActiveGrants(actor);
    return { id: { in: grants.map((g) => g.childId) } };
  }
  throw new AppError("You do not have permission to access children's vaccination records", 403);
};

/**
 * Stricter scope for editing a child's own personal details.
 *
 * D1: a hospital staff member may edit permitted contact/address fields only
 * when they (a) registered the child personally and (b) still hold a valid
 * grant for that child. Registration identity alone never grants access, and
 * another staff member verifying the child can never edit personal details.
 * Helpers keep their existing own-registration write scope.
 */
export const childWriteAccessFilter = async (actor: Actor): Promise<Prisma.ChildWhereInput> => {
  if (actor.role === 'HELPER') return { registeredById: actor.userId };
  if (actor.role === 'HOSPITAL_STAFF') {
    const grants = await getActiveGrants(actor);
    return { registeredById: actor.userId, id: { in: grants.map((g) => g.childId) } };
  }
  throw new AppError("You do not have permission to modify children's vaccination records", 403);
};

/** Explains how this user reached a child, for the response and the UI banner. */
export const describeChildAccess = async (
  actor: Actor,
  child: { id: string }
): Promise<ChildAccess> => {
  if (actor.role === 'HELPER') return { accessType: 'OWN', accessExpiresAt: null };

  if (actor.role === 'HOSPITAL_STAFF') {
    const grant = await getActiveGrantForChild(actor, child.id);
    if (grant) return { accessType: 'VERIFIED', accessExpiresAt: grant.expiresAt };
  }

  return { accessType: 'NONE', accessExpiresAt: null };
};
