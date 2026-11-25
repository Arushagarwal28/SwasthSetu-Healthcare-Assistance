import axiosClient from './axiosClient';
import type { AdminOverview, FacilityFormValues } from '../types/admin';

export const fetchAdminOverview = async (): Promise<AdminOverview> => {
  const res = await axiosClient.get('/facilities/admin/overview');
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
  });
  return res.data.data;
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
