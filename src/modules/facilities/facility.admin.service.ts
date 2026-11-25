import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

/** Everything the admin screen needs in one call, including inactive facilities. */
export const listFacilitiesForAdmin = async () => {
  const [facilities, specialtyRows] = await Promise.all([
    prisma.facility.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: {
        specialties: { select: { specialty: true }, orderBy: { specialty: 'asc' } },
        hospitalStaffLinks: { select: { user: { select: { id: true, email: true } } } },
      },
    }),
    // The specialties the triage data actually uses — the only ones that can ever match
    prisma.diseaseInfo.findMany({
      distinct: ['requiredSpecialty'],
      select: { requiredSpecialty: true },
      orderBy: { requiredSpecialty: 'asc' },
    }),
  ]);

  return {
    facilities: facilities.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      address: f.address,
      latitude: f.latitude,
      longitude: f.longitude,
      phone: f.phone,
      isActive: f.isActive,
      specialties: f.specialties.map((s) => s.specialty),
      staff: f.hospitalStaffLinks.map((l) => ({ userId: l.user.id, email: l.user.email })),
    })),
    specialtyOptions: specialtyRows.map((r) => r.requiredSpecialty),
  };
};

export interface FacilityUpdate {
  name?: string;
  type?: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  isActive?: boolean;
}

export const updateFacility = async (facilityId: string, input: FacilityUpdate) => {
  const existing = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!existing) throw new AppError('Facility not found', 404);

  const data = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(data).length === 0) throw new AppError('No changes provided', 400);

  return prisma.facility.update({
    where: { id: facilityId },
    data,
    select: {
      id: true, name: true, type: true, address: true,
      latitude: true, longitude: true, phone: true, isActive: true,
    },
  });
};

/** Replaces addFacilitySpecialty in facility.service.ts: same behaviour plus a vocabulary check. */
export const addFacilitySpecialty = async (facilityId: string, specialty: string) => {
  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) throw new AppError('Facility not found', 404);

  // A specialty no disease maps to could never be matched, so reject it
  const known = await prisma.diseaseInfo.findFirst({
    where: { requiredSpecialty: specialty },
    select: { id: true },
  });
  if (!known) {
    throw new AppError('Unknown specialty. Choose one of the specialties used by the triage data.', 400);
  }

  const existing = await prisma.facilitySpecialty.findUnique({
    where: { facilityId_specialty: { facilityId, specialty } },
  });
  if (existing) throw new AppError('Facility already has this specialty', 409);

  return prisma.facilitySpecialty.create({ data: { facilityId, specialty } });
};

export const removeFacilitySpecialty = async (facilityId: string, specialty: string) => {
  const result = await prisma.facilitySpecialty.deleteMany({ where: { facilityId, specialty } });
  if (result.count === 0) throw new AppError('This facility does not have that specialty', 404);
};

export const unlinkStaffFromFacility = async (facilityId: string, userId: string) => {
  const result = await prisma.hospitalStaffFacilityLink.deleteMany({ where: { facilityId, userId } });
  if (result.count === 0) throw new AppError('That staff member is not linked to this facility', 404);
};