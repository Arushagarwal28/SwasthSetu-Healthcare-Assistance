
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { canHelperAccessPatient } from '../helpers/helper.service';

export const createPatientProfile = async (userId: string, data: any) => {
  const existing = await prisma.patient.findUnique({ where: { userId } });

  if (existing) {
    throw new AppError('Patient profile already exists for this user', 409);
  }

  return prisma.patient.create({
    data: {
      userId,
      fullName: data.fullName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      phone: data.phone,
      address: data.address,
    },
  });
};

export const getPatientProfile = async (userId: string) => {
  const patient = await prisma.patient.findUnique({ where: { userId } });

  if (!patient) throw new AppError('Patient profile not found', 404);

  return patient;
};

export const getPatientById = async (
  requestingUser: { userId: string; role: string },
  patientId: string
) => {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });

  if (!patient) throw new AppError('Patient not found', 404);

  // Hospital staff cannot directly access patient profiles
  if (requestingUser.role === 'HOSPITAL_STAFF') {
    throw new AppError('You do not have permission to view this patient', 403);
  }

  if (requestingUser.role === 'PATIENT' && patient.userId !== requestingUser.userId) {
    throw new AppError('You do not have permission to view this patient', 403);
  }

  if (requestingUser.role === 'HELPER') {
    const authorized = await canHelperAccessPatient(requestingUser.userId, patientId);

    if (!authorized) {
      throw new AppError('You do not have permission to view this patient', 403);
    }
  }

  return patient;
};
