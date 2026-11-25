import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

export const createFacility = async (data: any) => {
  return prisma.facility.create({ data });
};

export const listFacilities = async () => {
  return prisma.facility.findMany({ where: { isActive: true } });
};

export const getFacilityById = async (id: string) => {
  const facility = await prisma.facility.findUnique({ where: { id } });
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