import axiosClient from './axiosClient';
import { type Assessment, type Severity,type NextQuestionResult  } from '../types/assessment';

export const createAssessment = async (patientId: string): Promise<Assessment> => {
  const res = await axiosClient.post('/assessments', { patientId });
  return res.data.data;
};

export const addSymptomsToAssessment = async (
  assessmentId: string,
  symptoms: { symptomId: string; severity: Severity; durationDays: number }[]
): Promise<Assessment> => {
  const res = await axiosClient.post(`/assessments/${assessmentId}/symptoms`, { symptoms });
  return res.data.data;
};

export const submitAssessment = async (assessmentId: string): Promise<Assessment> => {
  const res = await axiosClient.post(`/assessments/${assessmentId}/submit`);
  return res.data.data;
};

export const completeAssessment = async (assessmentId: string): Promise<Assessment> => {
  const res = await axiosClient.post(`/assessments/${assessmentId}/complete`);
  return res.data.data;
};

export const fetchPatientMe = async (): Promise<{ id: string }> => {
  const res = await axiosClient.get('/patients/me');
  return res.data.data;
};

export const getNextQuestion = async (assessmentId: string): Promise<NextQuestionResult> => {
  const res = await axiosClient.get(`/assessments/${assessmentId}/next-question`);
  return res.data.data;
};

export const addFollowUpAnswer = async (
  assessmentId: string,
  question: string,
  answer: 'yes' | 'no',
  symptomId: string
): Promise<void> => {
  await axiosClient.post(`/assessments/${assessmentId}/follow-up`, { question, answer, symptomId });
};