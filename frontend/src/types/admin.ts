export type FacilityType = 'PHC' | 'CHC' | 'HOSPITAL' | 'CLINIC' | 'OTHER';

export const FACILITY_TYPE_LABEL: Record<FacilityType, string> = {
  PHC: 'PHC',
  CHC: 'CHC',
  HOSPITAL: 'Hospital',
  CLINIC: 'Clinic',
  OTHER: 'Other',
};

/** ACTIVE is derived from status + expiry by the backend; EXPIRED/REVOKED are terminal. */
export type RegistrationCodeStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/** Metadata only. The code itself is shown once, when it is created or rotated. */
export interface FacilityRegistrationCodeInfo {
  status: RegistrationCodeStatus;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

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
  registrationCode: FacilityRegistrationCodeInfo | null;
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
  /** Custom code entered by the administrator (create only). */
  registrationCode?: string;
  /** Ask the server to generate a strong code (create only). */
  generateRegistrationCode?: boolean;
}

/** Returned once by create/rotate: the plaintext code is never retrievable again. */
export interface IssuedRegistrationCode {
  code: string;
  expiresAt: string | null;
}

export interface UnlinkedStaff {
  id: string;
  email: string;
  createdAt: string;
  isActive: boolean;
}
