import axiosClient from './axiosClient';
import type {
  AdminOverview, FacilityFormValues, IssuedRegistrationCode, UnlinkedStaff,
} from '../types/admin';

export const fetchAdminOverview = async (): Promise<AdminOverview> => {
  const res = await axiosClient.get('/facilities/admin/overview');
  return res.data.data;
};

export const fetchUnlinkedStaff = async (): Promise<UnlinkedStaff[]> => {
  const res = await axiosClient.get('/facilities/admin/unlinked-staff');
  return res.data.data;
};

export const createFacility = async (values: FacilityFormValues) => {
  const res = await axiosClient.post('/facilities', {
    name: values.name,
    type: values.type,
    address: values.address,
    phone: values.phone || undefined,
    latitude: values.latitude ?? undefined,
    longitude: values.longitude ?? undefined,
    ...(values.generateRegistrationCode
      ? { generateRegistrationCode: true }
      : { registrationCode: values.registrationCode?.trim() }),
  });
  // { ...facility, registrationCode: { code, expiresAt } } — the code is shown once.
  return res.data.data as { id: string; name: string; registrationCode: IssuedRegistrationCode };
};

export const updateFacility = async (id: string, values: FacilityFormValues) => {
  const res = await axiosClient.patch(`/facilities/${id}`, {
    name: values.name,
    type: values.type,
    address: values.address,
    phone: values.phone || null,
    latitude: values.latitude,
    longitude: values.longitude,
  });
  return res.data.data;
};

export const setFacilityActive = async (id: string, isActive: boolean) => {
  const res = await axiosClient.patch(`/facilities/${id}`, { isActive });
  return res.data.data;
};

export const addSpecialty = async (facilityId: string, specialty: string) => {
  const res = await axiosClient.post(`/facilities/${facilityId}/specialties`, { specialty });
  return res.data.data;
};

export const removeSpecialty = async (facilityId: string, specialty: string) => {
  await axiosClient.delete(`/facilities/${facilityId}/specialties/${encodeURIComponent(specialty)}`);
};

export const linkStaff = async (facilityId: string, email: string) => {
  const res = await axiosClient.post(`/facilities/${facilityId}/staff`, { email });
  return res.data.data;
};

export const unlinkStaff = async (facilityId: string, userId: string) => {
  await axiosClient.delete(`/facilities/${facilityId}/staff/${userId}`);
};

// ---------- facility registration codes ----------

export const createFacilityCode = async (
  facilityId: string,
  input: { code?: string; expiresAt?: string | null } = {},
): Promise<IssuedRegistrationCode> => {
  const res = await axiosClient.post(`/facilities/${facilityId}/registration-code`, input);
  return res.data.data;
};

export const rotateFacilityCode = async (
  facilityId: string,
  input: { code?: string; expiresAt?: string | null } = {},
): Promise<IssuedRegistrationCode> => {
  const res = await axiosClient.post(`/facilities/${facilityId}/registration-code/rotate`, input);
  return res.data.data;
};

export const revokeFacilityCode = async (facilityId: string): Promise<void> => {
  await axiosClient.post(`/facilities/${facilityId}/registration-code/revoke`);
};

export const setFacilityCodeExpiry = async (
  facilityId: string,
  expiresAt: string | null,
): Promise<void> => {
  await axiosClient.patch(`/facilities/${facilityId}/registration-code`, { expiresAt });
};
