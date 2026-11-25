import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { createAssessment, getAssessmentById } from './assessment.service';
import { addSymptoms, addFollowUpAnswer, submitAssessment, completeAssessment,getFollowUpQuestion } from './assessment.service';
import { getRecommendedFacilities } from '../triage/triage.service';
import { AppError } from '../../middlewares/errorHandler';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assessment = await createAssessment(req.user!, req.body.patientId);
    res.status(201).json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new Error('Invalid assessment ID'));
    }

    const assessment = await getAssessmentById(req.user!, id);

    res.status(200).json({ success: true, data: assessment });
  } catch (err) {
    next(err);
  }
};

export const addSymptomsHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new Error('Invalid assessment ID'));
    }

    const result = await addSymptoms(req.user!, id, req.body.symptoms);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const addFollowUpHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await addFollowUpAnswer(
      req.user!,
      req.params.id as string,
      req.body.question,
      req.body.answer,
      req.body.symptomId
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const nextQuestionHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await getFollowUpQuestion(req.user!, req.params.id as string);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const submitHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new Error('Invalid assessment ID'));
    }

    const result = await submitAssessment(req.user!, id);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const completeHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new Error('Invalid assessment ID'));
    }

    const result = await completeAssessment(req.user!, id);

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const recommendedFacilitiesHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
const { lat, lng } = req.query;

const assessmentId = req.params.id;

if (!assessmentId || Array.isArray(assessmentId)) {
  throw new AppError('Invalid assessment ID', 400);
}

const coords =
  lat !== undefined && lng !== undefined
    ? {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
      }
    : undefined;

const result = await getRecommendedFacilities(
  req.user!,
  assessmentId,
  coords
);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};