    import axios from 'axios';
import { AppError } from '../../middlewares/errorHandler';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT = parseInt(process.env.ML_SERVICE_TIMEOUT_MS || '5000', 10);

interface PredictionItem {
  disease: string;
  probability: number;
}

interface PredictionResult {
  predicted_disease: string;
  confidence: number;
  top_predictions: PredictionItem[];
  unrecognized_symptoms: string[];
}

interface NextQuestionResult {
  needs_followup: boolean;
  predicted_disease: string;
  confidence: number;
  top_predictions: { disease: string; probability: number }[];
  next_symptom_key: string | null;
}

export const getPrediction = async (symptomKeys: string[]): Promise<PredictionResult> => {
  try {
    const response = await axios.post<PredictionResult>(
      `${ML_SERVICE_URL}/predict`,
      { symptoms: symptomKeys },
      { timeout: TIMEOUT }
    );
    return response.data;
  } catch (err: any) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
        throw new AppError('Prediction service is currently unavailable. Please try again shortly.', 503);
      }
      if (err.response?.status === 400) {
        throw new AppError(err.response.data?.detail || 'Unable to generate prediction from provided symptoms', 400);
      }
    }
    throw new AppError('Prediction service failed unexpectedly', 502);
  }
};

export const getNextQuestion = async (
  symptomKeys: string[],
  excludedKeys: string[],
  confidenceThreshold: number
): Promise<NextQuestionResult> => {
  try {
    const response = await axios.post<NextQuestionResult>(
      `${ML_SERVICE_URL}/next-question`,
      { symptoms: symptomKeys, excluded_symptoms: excludedKeys, confidence_threshold: confidenceThreshold },
      { timeout: TIMEOUT }
    );
    return response.data;
  } catch (err: any) {
    if (axios.isAxiosError(err) && (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED')) {
      throw new AppError('Prediction service is currently unavailable. Please try again shortly.', 503);
    }
    throw new AppError('Prediction service failed unexpectedly', 502);
  }
};