export interface RecommendedFacility {
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

export interface RecommendationResult {
  predictedDisease: string;
  urgency: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  requiredSpecialty: string;
  usedFallback: boolean;
  explanation: string;
  facilities: RecommendedFacility[];
}