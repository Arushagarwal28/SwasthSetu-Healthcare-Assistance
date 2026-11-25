import axiosClient from './axiosClient';
import type {
  Referral,
  ReferralSummary,
  IncomingReferralsResponse,
  ReferralStatus,
} from '../types/referral';
import type { RecommendationResult } from '../types/facility';

type Coords = { lat: number; lng: number };

// ---- Patient / Helper side ----

export const createReferral = async (
  assessmentId: string,
  destinationFacilityId: string,
  notes?: string
): Promise<Referral> => {
  const res = await axiosClient.post('/referrals', {
    assessmentId,
    destinationFacilityId,
    notes: notes || undefined,
  });
  return res.data.data;
};

/** Returns null when no referral exists yet for the assessment. */
export const fetchReferralByAssessment = async (assessmentId: string): Promise<Referral | null> => {
  try {
    const res = await axiosClient.get(`/referrals/by-assessment/${assessmentId}`);
    return res.data.data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};

export const cancelReferral = async (referralId: string): Promise<Referral> => {
  const res = await axiosClient.post(`/referrals/${referralId}/cancel`);
  return res.data.data;
};

export const fetchNextSuggestions = async (
  referralId: string,
  coords?: Coords
): Promise<RecommendationResult> => {
  const res = await axiosClient.get(`/referrals/${referralId}/next-suggestions`, {
    params: coords ? { lat: coords.lat, lng: coords.lng } : {},
  });
  return res.data.data;
};

/** Referrals for the logged-in patient, or for all of a helper's linked patients. */
export const fetchMyReferrals = async (): Promise<ReferralSummary[]> => {
  const res = await axiosClient.get('/referrals/mine');
  return res.data.data;
};

// ---- Hospital staff side ----

export const fetchIncomingReferrals = async (
  status?: ReferralStatus
): Promise<IncomingReferralsResponse> => {
  const res = await axiosClient.get('/referrals/incoming', {
    params: status ? { status } : {},
  });
  return res.data.data;
};

export const acceptReferral = async (id: string, data: { scheduledAt?: string; note?: string }) =>
  (await axiosClient.post(`/referrals/${id}/accept`, data)).data.data;

export const rejectReferral = async (id: string, reason: string) =>
  (await axiosClient.post(`/referrals/${id}/reject`, { reason })).data.data;

export const rescheduleReferral = async (id: string, scheduledAt: string, note?: string) =>
  (await axiosClient.post(`/referrals/${id}/reschedule`, { scheduledAt, note })).data.data;

export const completeReferral = async (id: string, note?: string) =>
  (await axiosClient.post(`/referrals/${id}/complete`, { note })).data.data;