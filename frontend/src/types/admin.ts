export type FacilityType = 'PHC' | 'CHC' | 'HOSPITAL' | 'CLINIC' | 'OTHER';

export const FACILITY_TYPE_LABEL: Record<FacilityType, string> = {
  PHC: 'PHC',
  CHC: 'CHC',
  HOSPITAL: 'Hospital',
  CLINIC: 'Clinic',
  OTHER: 'Other',
};

/** One facility as returned by GET /facilities/admin/overview. */
export interface AdminFacility {
  id: string;
  name: string;
  type: FacilityType;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  isActive: boolean;
  specialties: string[];
  staff: { userId: string; email: string }[];
}

export interface AdminOverview {
  facilities: AdminFacility[];
  /** Specialties used by the triage data — the only ones that can ever match. */
  specialtyOptions: string[];
}

export interface FacilityFormValues {
  name: string;
  type: FacilityType;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
}
