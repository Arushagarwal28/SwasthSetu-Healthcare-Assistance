import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { assertCanActOnPatient } from '../assessments/assessment.service';
import { haversineDistanceKm } from '../../utils/geo';

export interface RankedFacility {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  matchedSpecialty: boolean;
  distanceKm: number | null;
}

export const getRecommendedFacilities = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string,
  coords?: { lat: number; lng: number },
  excludeFacilityIds: string[] = []
) => {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw new AppError('Assessment not found', 404);
  await assertCanActOnPatient(requestingUser, assessment.patientId);

  if (assessment.status !== 'COMPLETED' || !assessment.predictedDisease) {
    throw new AppError('Recommendations are only available for a completed assessment', 400);
  }

  const diseaseInfo = await prisma.diseaseInfo.findUnique({
    where: { diseaseName: assessment.predictedDisease },
  });

  if (!diseaseInfo) {
    throw new AppError(
      `No triage information is configured for "${assessment.predictedDisease}" yet`,
      404
    );
  }

  // Preferred: facilities explicitly tagged with the required specialty
  const specialtyMatches = await prisma.facility.findMany({
    where: {
      isActive: true,
      id: { notIn: excludeFacilityIds },
      specialties: { some: { specialty: diseaseInfo.requiredSpecialty } },
    },
  });

  let pool = specialtyMatches;
  let usedFallback = false;

  // Fallback: no facility is tagged with that specialty yet — don't leave a
  // rural patient with nothing. Fall back to any active hospital/CHC instead.
  if (pool.length === 0) {
    usedFallback = true;
    pool = await prisma.facility.findMany({
      where: { isActive: true, id: { notIn: excludeFacilityIds }, type: { in: ['HOSPITAL', 'CHC','PHC'] } },
    });
  }

  const ranked: RankedFacility[] = pool.map((f) => {
    const distanceKm =
      coords && f.latitude != null && f.longitude != null
        ? Math.round(haversineDistanceKm(coords.lat, coords.lng, f.latitude, f.longitude) * 10) / 10
        : null;

    return {
      id: f.id,
      name: f.name,
      type: f.type,
      address: f.address,
      phone: f.phone,
      latitude: f.latitude,
      longitude: f.longitude,
      matchedSpecialty: !usedFallback,
      distanceKm,
    };
  });

  // Rank by distance when we have it (patient's coords were passed in);
  // otherwise leave the already-filtered/relevant DB order as-is.
  ranked.sort((a, b) => {
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm != null) return -1;
    if (b.distanceKm != null) return 1;
    return 0;
  });

  return {
    predictedDisease: assessment.predictedDisease,
    urgency: diseaseInfo.urgency,
    requiredSpecialty: diseaseInfo.requiredSpecialty,
    usedFallback,
    explanation: usedFallback
      ? `No facility is currently tagged for ${diseaseInfo.requiredSpecialty}, so general hospitals/CHCs are shown instead.`
      : `Facilities tagged with ${diseaseInfo.requiredSpecialty}, matching the screening result.`,
    facilities: ranked,
  };
};