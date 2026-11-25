export type ReferralStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export type Urgency = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface ReferralHistoryItem {
  id: string;
  fromStatus: ReferralStatus | null;
  toStatus: ReferralStatus;
  changedById: string;
  note: string | null;
  createdAt: string;
}

export interface FacilitySummary {
  id: string;
  name: string;
  address?: string;
  phone?: string | null;
}

/** Referral as seen by the Patient / Helper who created it. */
export interface Referral {
  id: string;
  assessmentId: string;
  patientId: string;
  status: ReferralStatus;
  notes: string | null;
  hospitalNote: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceFacility: FacilitySummary | null;
  destinationFacility: FacilitySummary;
  history: ReferralHistoryItem[];
}

/** Referral as seen by hospital staff (GET /referrals/incoming). */
export interface IncomingReferral {
  id: string;
  status: ReferralStatus;
  notes: string | null;
  hospitalNote: string | null;
  scheduledAt: string | null;
  createdAt: string;
  urgency: Urgency | null;
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: string;
    gender: string;
    phone: string | null;
  };
  assessment: {
    id: string;
    predictedDisease: string | null;
    predictionConfidence: number | null;
    symptoms: {
      severity: string | null;
      durationDays: number | null;
      symptom: { name: string };
    }[];
  };
  sourceFacility: { id: string; name: string } | null;
  destinationFacility: { id: string; name: string };
}

export interface IncomingReferralsResponse {
  facilities: { id: string; name: string }[];
  referrals: IncomingReferral[];
}

/** One row of GET /referrals/mine (Patient / Helper dashboards). */
export interface ReferralSummary {
  id: string;
  assessmentId: string;
  status: ReferralStatus;
  scheduledAt: string | null;
  hospitalNote: string | null;
  createdAt: string;
  updatedAt: string;
  patient: { id: string; fullName: string };
  destinationFacility: { id: string; name: string };
  assessment: { predictedDisease: string | null };
}