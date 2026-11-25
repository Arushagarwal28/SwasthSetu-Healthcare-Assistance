import axiosClient from './axiosClient';
import { type Symptom } from '../types/assessment';

export const fetchSymptoms = async (): Promise<Symptom[]> => {
  const res = await axiosClient.get('/symptoms');
  return res.data.data;
};