import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { createFirstCodeInTx } from './facility.code.service';
import type { IssuedCode } from './facility.code.service';

export interface CreateFacilityInput {
  name: string;
  type: string;
  address: string;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pinCode?: string | null;
  district?: string | null;
  /** Optional custom code; otherwise `generateRegistrationCode` must be true. */
  registrationCode?: string | null;
  generateRegistrationCode?: boolean;
}

/**
 * Creates the facility and its first registration code in ONE transaction, so a
 * facility can never exist without a code an administrator can hand out.
 * The plaintext code is returned once and never stored.
 */
export const createFacility = async (
  input: CreateFacilityInput,
  actorId: string
): Promise<{
  facility: { id: string; name: string; type: string; address: string; isActive: boolean };
  registrationCode: IssuedCode;
}> => {
  const customCode = (input.registrationCode ?? '').trim();
  if (!customCode && input.generateRegistrationCode !== true) {
    throw new AppError('Enter a registration code or generate one', 400);
  }

  return prisma.$transaction(async (tx) => {
    const facility = await tx.facility.create({
      data: {
        name: input.name,
        type: input.type as never,
        address: input.address,
        phone: input.phone ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        pinCode: input.pinCode ?? null,
        district: input.district ?? null,
      },
      select: { id: true, name: true, type: true, address: true, isActive: true },
    });

    const issued = await createFirstCodeInTx(tx, {
      facilityId: facility.id,
      actorId,
      customCode: customCode || null,
    });

    return { facility, registrationCode: issued };
  });
};

export const listFacilities = async () => {
  return prisma.facility.findMany({
    where: { isActive: true },
    // Never select registration code columns here: this list is available to
    // every signed-in user so the child registration form can offer choices.
    select: {
      id: true, name: true, type: true, address: true, latitude: true, longitude: true,
      phone: true, isActive: true, pinCode: true, district: true,
    },
  });
};

export const getFacilityById = async (id: string) => {
  const facility = await prisma.facility.findUnique({
    where: { id },
    select: {
      id: true, name: true, type: true, address: true, latitude: true, longitude: true,
      phone: true, isActive: true, pinCode: true, district: true,
    },
  });
  if (!facility) throw new AppError('Facility not found', 404);
  return facility;
};

export const linkStaffToFacility = async (facilityId: string, email: string) => {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) throw new AppError('Facility not found', 404);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError('No user found with that email', 404);
  if (user.role !== 'HOSPITAL_STAFF') {
    throw new AppError('Only HOSPITAL_STAFF users can be linked to a facility', 400);
  }

  const existing = await prisma.hospitalStaffFacilityLink.findUnique({
    where: { userId_facilityId: { userId: user.id, facilityId } },
  });
  if (existing) throw new AppError('This staff member is already linked to the facility', 409);

  return prisma.hospitalStaffFacilityLink.create({
    data: { userId: user.id, facilityId },
    select: { id: true, userId: true, facilityId: true, createdAt: true },
  });
};

/** The signed-in hospital staff member's own facility details (never codes). */
export const listMyFacilities = async (userId: string) => {
  const links = await prisma.hospitalStaffFacilityLink.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: {
      facility: {
        select: {
          id: true, name: true, type: true, address: true, phone: true,
          district: true, pinCode: true, isActive: true,
        },
      },
    },
  });
  return links.map((l) => l.facility);
};

/** Hospital staff accounts that are not linked to any facility yet. */
export const listUnlinkedHospitalStaff = async () => {
  return prisma.user.findMany({
    where: { role: 'HOSPITAL_STAFF', hospitalStaffLinks: { none: {} } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, createdAt: true, isActive: true },
    take: 200,
  });
};
