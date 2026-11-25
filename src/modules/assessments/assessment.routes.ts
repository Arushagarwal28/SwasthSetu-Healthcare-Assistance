import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { nextQuestionHandler } from './assessment.controller';
import { query } from 'express-validator';
import { recommendedFacilitiesHandler } from './assessment.controller';

import {
  createAssessmentValidation,
  addSymptomsValidation,
  addFollowUpValidation,
} from './assessment.validation';

import {
  create,
  getById,
  addSymptomsHandler,
  addFollowUpHandler,
  submitHandler,
  completeHandler,
} from './assessment.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  validate(createAssessmentValidation),
  create
);

router.get(
  '/:id',
  authenticate,
  getById
);

router.post(
  '/:id/symptoms',
  authenticate,
  validate(addSymptomsValidation),
  addSymptomsHandler
);

router.post(
  '/:id/follow-up',
  authenticate,
  validate(addFollowUpValidation),
  addFollowUpHandler
);

router.post(
  '/:id/submit',
  authenticate,
  submitHandler
);

router.post(
  '/:id/complete',
  authenticate,
  completeHandler
);

router.get('/:id/next-question', authenticate, nextQuestionHandler);

router.get(
  '/:id/recommended-facilities',
  authenticate,
  validate([
    query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be between -90 and 90'),
    query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180'),
  ]),
  recommendedFacilitiesHandler
);

export default router;