import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

export const createHelperProfile = async (userId: string, data: any) => {
  const existing = await prisma.helperProfile.findUnique({ where: { userId } });
  if (existing) {
    throw new AppError('Helper profile already exists for this user', 409);
  }

  return prisma.helperProfile.create({
    data: { userId, fullName: data.fullName, phone: data.phone },
  });
};

export const getHelperProfile = async (userId: string) => {
  const helper = await prisma.helperProfile.findUnique({ where: { userId } });
  if (!helper) throw new AppError('Helper profile not found', 404);
  return helper;
};

// --- Helper <-> Facility ---

export const linkHelperToFacility = async (userId: string, facilityId: string) => {
  const helper = await getHelperProfile(userId);

  const facility = await prisma.facility.findUnique({ where: { id: facilityId } });
  if (!facility) throw new AppError('Facility not found', 404);

  const existing = await prisma.helperFacilityLink.findUnique({
    where: { helperId_facilityId: { helperId: helper.id, facilityId } },
  });
  if (existing) throw new AppError('Helper is already linked to this facility', 409);

  return prisma.helperFacilityLink.create({
    data: { helperId: helper.id, facilityId },
  });
};

// --- Helper <-> Patient (the core access-control link) ---

export const linkHelperToPatient = async (userId: string, patientId: string) => {
  const helper = await getHelperProfile(userId);

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  const existing = await prisma.patientHelperLink.findUnique({
    where: { patientId_helperId: { patientId, helperId: helper.id } },
  });
  if (existing) throw new AppError('Helper is already linked to this patient', 409);

  return prisma.patientHelperLink.create({
    data: { helperId: helper.id, patientId },
  });
};

export const getAuthorizedPatients = async (userId: string) => {
  const helper = await getHelperProfile(userId);

  const links = await prisma.patientHelperLink.findMany({
    where: { helperId: helper.id },
    include: { patient: true },
  });

  return links.map((l) => l.patient);
};

// Used by other modules (assessments, etc.) to check access
export const canHelperAccessPatient = async (userId: string, patientId: string): Promise<boolean> => {
  const helper = await prisma.helperProfile.findUnique({ where: { userId } });
  if (!helper) return false;

  const link = await prisma.patientHelperLink.findUnique({
    where: { patientId_helperId: { patientId, helperId: helper.id } },
  });
  return !!link;
};

export const registerPatientByHelper = async (userId: string, data: any) => {
  const helper = await getHelperProfile(userId);

  const patient = await prisma.patient.create({
    data: {
      fullName: data.fullName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      phone: data.phone,
      address: data.address,
      createdByHelperId: helper.id,
    },
  });

  await prisma.patientHelperLink.create({
    data: { helperId: helper.id, patientId: patient.id },
  });

  return patient;
};