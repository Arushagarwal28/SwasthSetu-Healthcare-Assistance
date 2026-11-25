export interface Symptom {
  id: string;
  key: string;
  name: string;
  category: string | null;
}

export type Severity = 'MILD' | 'MODERATE' | 'SEVERE';

export interface SelectedSymptom {
  symptomId: string;
  name: string;
  severity: Severity;
  durationDays: number;
}

export type AssessmentStatus =
  | 'CREATED'
  | 'SYMPTOMS_ADDED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'COMPLETED';

export interface PredictionItem {
  disease: string;
  probability: number;
}

export interface PredictionDetails {
  predicted_disease: string;
  confidence: number;
  top_predictions: PredictionItem[];
  unrecognized_symptoms: string[];
}

export interface Assessment {
  id: string;
  patientId: string;
  status: AssessmentStatus;
  predictedDisease: string | null;
  predictionConfidence: number | null;
  predictionDetails: PredictionDetails | null;
  createdAt: string;
  completedAt: string | null;
}

export interface NextQuestionResult {
  needsFollowup: boolean;
  reachedMaxRounds: boolean;
  question: {
    symptomId: string;
    symptomName: string;
    questionText: string;
  } | null;
}