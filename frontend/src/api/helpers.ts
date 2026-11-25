import axiosClient from './axiosClient';
import { type Patient } from '../types/patient';

export const fetchLinkedPatients = async (): Promise<Patient[]> => {
  const res = await axiosClient.get('/helpers/me/patients');
  return res.data.data;
};

export const registerPatientByHelper = async (data: {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
}): Promise<Patient> => {
  const res = await axiosClient.post('/helpers/me/patients/new', data);
  return res.data.data;
};