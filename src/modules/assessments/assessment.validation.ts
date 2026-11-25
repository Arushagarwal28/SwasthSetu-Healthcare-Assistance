import { body } from 'express-validator';

export const createAssessmentValidation = [
  body('patientId').isUUID().withMessage('Valid patientId is required'),
];

export const addSymptomsValidation = [
  body('symptoms').isArray({ min: 1 }).withMessage('At least one symptom is required'),
  body('symptoms.*.symptomId').isUUID().withMessage('Valid symptomId is required'),
  body('symptoms.*.severity').optional().isIn(['MILD', 'MODERATE', 'SEVERE']),
  body('symptoms.*.durationDays').optional().isInt({ min: 0 }),
];


export const addFollowUpValidation = [
  body('question').notEmpty().withMessage('Question is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('symptomId').optional().isUUID().withMessage('symptomId must be a valid UUID'),
];