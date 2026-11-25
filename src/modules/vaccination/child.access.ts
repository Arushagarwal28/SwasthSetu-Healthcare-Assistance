import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

export interface Actor {
  userId: string;
  role: string;
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
 * Which children a user may see, as a Prisma filter:
 *  - HELPER:         children they registered themselves
 *  - HOSPITAL_STAFF: children assigned to a facility they are linked to
 *  - everyone else (including ADMIN): none. Children's records are personal
 *    medical data; admin gets aggregate statistics later, not individual records.
 */
export const childAccessFilter = async (actor: Actor): Promise<Prisma.ChildWhereInput> => {
  if (actor.role === 'HELPER') return { registeredById: actor.userId };
  if (actor.role === 'HOSPITAL_STAFF') {
    const facilityIds = await getLinkedFacilityIds(actor);
    return { assignedFacilityId: { in: facilityIds } }; // empty list matches nothing
  }
  throw new AppError("You do not have permission to access children's vaccination records", 403);
};
