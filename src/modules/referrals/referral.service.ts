import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { assertCanActOnPatient } from '../assessments/assessment.service';
import { getRecommendedFacilities } from '../triage/triage.service';
import { notifyReferralChange } from '../../realtime/socket';
const ACTIVE_STATUSES = ['PENDING', 'ACCEPTED', 'RESCHEDULED'];

const referralInclude = {
  sourceFacility: true,
  destinationFacility: true,
  history: { orderBy: { createdAt: 'asc' as const } },
};

export const createReferral = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string,
  destinationFacilityId: string,
  notes?: string
) => {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw new AppError('Assessment not found', 404);
  await assertCanActOnPatient(requestingUser, assessment.patientId);

  if (assessment.status !== 'COMPLETED') {
    throw new AppError('A referral can only be created from a completed assessment', 400);
  }

  const existingActive = await prisma.referral.findFirst({
    where: { assessmentId, status: { in: ACTIVE_STATUSES as any } },
  });
  if (existingActive) {
    throw new AppError('An active referral already exists for this assessment', 409);
  }

  const destinationFacility = await prisma.facility.findUnique({
    where: { id: destinationFacilityId },
  });
  if (!destinationFacility || !destinationFacility.isActive) {
    throw new AppError('Destination facility not found', 404);
  }

  // If the requester is a Helper, use their linked facility as the referral source
  let sourceFacilityId: string | null = null;
  if (requestingUser.role === 'HELPER') {
    const helper = await prisma.helperProfile.findUnique({
      where: { userId: requestingUser.userId },
      include: { facilityLinks: true },
    });
    sourceFacilityId = helper?.facilityLinks[0]?.facilityId ?? null;
  }

  const referral = await prisma.referral.create({
    data: {
      assessmentId,
      patientId: assessment.patientId,
      sourceFacilityId,
      destinationFacilityId,
      createdById: requestingUser.userId,
      status: 'PENDING',
      notes: notes ?? null,
    },
    include: referralInclude,
  });

  await prisma.referralHistory.create({
    data: {
      referralId: referral.id,
      fromStatus: null,
      toStatus: 'PENDING',
      changedById: requestingUser.userId,
      note: 'Referral created',
    },
  });
  void notifyReferralChange(referral, 'created');
  return referral;
};

export const getReferralById = async (
  requestingUser: { userId: string; role: string },
  referralId: string
) => {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
    include: referralInclude,
  });
  if (!referral) throw new AppError('Referral not found', 404);

  if (requestingUser.role === 'HOSPITAL_STAFF') {
    await loadReferralForStaff(requestingUser.userId, referralId);
  } else {
    await assertCanActOnPatient(requestingUser, referral.patientId);
  }
  return referral;
};
export const getReferralByAssessment = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string
) => {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw new AppError('Assessment not found', 404);
  await assertCanActOnPatient(requestingUser, assessment.patientId);

  const referral = await prisma.referral.findFirst({
    where: { assessmentId },
    include: referralInclude,
    orderBy: { createdAt: 'desc' },
  });
  if (!referral) throw new AppError('No referral exists for this assessment', 404);
  return referral;
};

export const cancelReferral = async (
  requestingUser: { userId: string; role: string },
  referralId: string
) => {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError('Referral not found', 404);
  await assertCanActOnPatient(requestingUser, referral.patientId);

  if (referral.status !== 'PENDING') {
    throw new AppError(`Cannot cancel a referral that is already ${referral.status}`, 400);
  }

  const updated = await prisma.referral.update({
    where: { id: referralId },
    data: { status: 'CANCELLED' },
    include: referralInclude,
  });

  await prisma.referralHistory.create({
    data: {
      referralId,
      fromStatus: 'PENDING',
      toStatus: 'CANCELLED',
      changedById: requestingUser.userId,
    },
  });
  void notifyReferralChange(updated, 'updated');
  return updated;
};

// ---------- Hospital-side workflow ----------

// target status -> statuses it may be reached from
const STAFF_TRANSITIONS: Record<string, string[]> = {
  ACCEPTED: ['PENDING'],
  REJECTED: ['PENDING'],
  RESCHEDULED: ['PENDING', 'ACCEPTED', 'RESCHEDULED'],
  COMPLETED: ['ACCEPTED', 'RESCHEDULED'],
};

type StaffTarget = 'ACCEPTED' | 'REJECTED' | 'RESCHEDULED' | 'COMPLETED';

const loadReferralForStaff = async (staffUserId: string, referralId: string) => {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError('Referral not found', 404);

  const link = await prisma.hospitalStaffFacilityLink.findUnique({
    where: { userId_facilityId: { userId: staffUserId, facilityId: referral.destinationFacilityId } },
  });
  if (!link) throw new AppError('You do not have permission to act on this referral', 403);

  return referral;
};

const transitionByStaff = async (
  staffUserId: string,
  referralId: string,
  toStatus: StaffTarget,
  data: { scheduledAt?: Date; note?: string }
) => {
  const referral = await loadReferralForStaff(staffUserId, referralId);

  const allowedStatuses = STAFF_TRANSITIONS[toStatus];

  if (!allowedStatuses?.includes(referral.status)) {
    throw new AppError(
      `Cannot move a referral from ${referral.status} to ${toStatus}`,
      400
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Conditional update: only succeeds if the status is still what we read,
    // so two staff acting at once can't both "win".
    const result = await tx.referral.updateMany({
      where: { id: referralId, status: referral.status },
      data: {
        status: toStatus,
        hospitalNote: data.note ?? null,
        ...(data.scheduledAt && { scheduledAt: data.scheduledAt }),
      },
    });

    if (result.count === 0) {
      throw new AppError('This referral was just updated by someone else. Please refresh.', 409);
    }

    await tx.referralHistory.create({
      data: {
        referralId,
        fromStatus: referral.status,
        toStatus,
        changedById: staffUserId,
        note: data.note ?? null,
      },
    });

    return tx.referral.findUniqueOrThrow({
      where: { id: referralId },
      include: referralInclude,
    });
  });

  // Notify only after the transaction commits, using the fully updated referral.
  void notifyReferralChange(updated, 'updated');
  return updated;
};

export const acceptReferral = (
  staffUserId: string,
  id: string,
  scheduledAt?: string,
  note?: string
) =>
  transitionByStaff(staffUserId, id, 'ACCEPTED', {
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    ...(note !== undefined ? { note } : {}),
  });

export const rejectReferral = (staffUserId: string, id: string, reason: string) =>
  transitionByStaff(staffUserId, id, 'REJECTED', { note: reason });

export const rescheduleReferral = (
  staffUserId: string,
  id: string,
  scheduledAt: string,
  note?: string
) =>
  transitionByStaff(staffUserId, id, 'RESCHEDULED', {
    scheduledAt: new Date(scheduledAt),
    ...(note !== undefined ? { note } : {}),
  });

export const completeReferral = (
  staffUserId: string,
  id: string,
  note?: string
) =>
  transitionByStaff(staffUserId, id, 'COMPLETED', {
    ...(note !== undefined ? { note } : {}),
  });

const URGENCY_WEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MODERATE: 2, LOW: 1 };

export const getIncomingReferrals = async (staffUserId: string, status?: string) => {
  const links = await prisma.hospitalStaffFacilityLink.findMany({
    where: { userId: staffUserId },
    include: { facility: { select: { id: true, name: true } } },
  });
  const facilityIds = links.map((l) => l.facilityId);
  const facilities = links.map((l) => l.facility);

  if (facilityIds.length === 0) return { facilities, referrals: [] };

  const referrals = await prisma.referral.findMany({
    where: {
      destinationFacilityId: { in: facilityIds },
      ...(status ? { status: status as any } : {}),
    },
    include: {
      patient: { select: { id: true, fullName: true, dateOfBirth: true, gender: true, phone: true } },
      assessment: {
        select: {
          id: true,
          predictedDisease: true,
          predictionConfidence: true,
          symptoms: {
            select: { severity: true, durationDays: true, symptom: { select: { name: true } } },
          },
        },
      },
      sourceFacility: { select: { id: true, name: true } },
      destinationFacility: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const diseaseNames = Array.from(
    new Set(referrals.map((r) => r.assessment.predictedDisease).filter((d): d is string => !!d))
  );
  const infos = await prisma.diseaseInfo.findMany({ where: { diseaseName: { in: diseaseNames } } });
  const urgencyByDisease = new Map(infos.map((i) => [i.diseaseName, i.urgency as string]));

  const enriched = referrals.map((r) => ({
    ...r,
    urgency: r.assessment.predictedDisease ? urgencyByDisease.get(r.assessment.predictedDisease) ?? null : null,
  }));

  // Most urgent first, then oldest first
  enriched.sort(
    (a, b) =>
      (URGENCY_WEIGHT[b.urgency ?? ''] ?? 0) - (URGENCY_WEIGHT[a.urgency ?? ''] ?? 0) ||
      a.createdAt.getTime() - b.createdAt.getTime()
  );

  return { facilities, referrals: enriched };
};

// ---------- After a rejection: suggest the next facility ----------

export const getNextSuggestions = async (
  requestingUser: { userId: string; role: string },
  referralId: string,
  coords?: { lat: number; lng: number }
) => {
  const referral = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!referral) throw new AppError('Referral not found', 404);
  await assertCanActOnPatient(requestingUser, referral.patientId);

  if (referral.status !== 'REJECTED') {
    throw new AppError('Next-facility suggestions are only available for a rejected referral', 400);
  }

  // Never suggest a facility already tried for this assessment
  const previous = await prisma.referral.findMany({
    where: { assessmentId: referral.assessmentId },
    select: { destinationFacilityId: true },
  });

  return getRecommendedFacilities(
    requestingUser,
    referral.assessmentId,
    coords,
    previous.map((r) => r.destinationFacilityId)
  );
};