import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';

const MAX_RESULTS = 50;

/**
 * Referrals for the patients this user is allowed to act for:
 *  - PATIENT: their own patient record
 *  - HELPER:  every patient linked to them through PatientHelperLink
 * Same access rule as assertCanActOnPatient, applied to a list.
 */
export const getMyReferrals = async (requestingUser: { userId: string; role: string }) => {
  let patientIds: string[];

  if (requestingUser.role === 'PATIENT') {
    const patient = await prisma.patient.findUnique({
      where: { userId: requestingUser.userId },
      select: { id: true },
    });
    if (!patient) return [];
    patientIds = [patient.id];
  } else if (requestingUser.role === 'HELPER') {
    const helper = await prisma.helperProfile.findUnique({
      where: { userId: requestingUser.userId },
      select: { id: true },
    });
    if (!helper) return [];
    const links = await prisma.patientHelperLink.findMany({
      where: { helperId: helper.id },
      select: { patientId: true },
    });
    patientIds = links.map((l) => l.patientId);
  } else {
    throw new AppError('You do not have permission to view referrals this way', 403);
  }

  if (patientIds.length === 0) return [];

  return prisma.referral.findMany({
    where: { patientId: { in: patientIds } },
    orderBy: { updatedAt: 'desc' },
    take: MAX_RESULTS,
    select: {
      id: true,
      assessmentId: true,
      status: true,
      scheduledAt: true,
      hospitalNote: true,
      createdAt: true,
      updatedAt: true,
      patient: { select: { id: true, fullName: true } },
      destinationFacility: { select: { id: true, name: true } },
      assessment: { select: { predictedDisease: true } },
    },
  });
};