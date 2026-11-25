import axiosClient from './axiosClient';
import { type RecommendationResult } from '../types/facility';

export const fetchRecommendedFacilities = async (
  assessmentId: string,
  coords?: { lat: number; lng: number }
): Promise<RecommendationResult> => {
  const params = coords ? { lat: coords.lat, lng: coords.lng } : {};
  const res = await axiosClient.get(`/assessments/${assessmentId}/recommended-facilities`, { params });
  return res.data.data;
};