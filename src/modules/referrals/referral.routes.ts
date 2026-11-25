
import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';

import {
  createReferralValidation,
  acceptReferralValidation,
  rejectReferralValidation,
  rescheduleReferralValidation,
  completeReferralValidation,
} from './referral.validation';

import {
  create,
  getById,
  getByAssessment,
  cancel,
  incoming,
  accept,
  reject,
  reschedule,
  complete,
  nextSuggestions,
  mine,
} from './referral.controller';

const router = Router();

const staffOnly = [authenticate, authorize('HOSPITAL_STAFF')];

// Patient / Helper routes
router.post('/', authenticate, validate(createReferralValidation), create);

router.get(
  '/by-assessment/:assessmentId',
  authenticate,
  getByAssessment
);

// Hospital staff routes
router.get(
  '/incoming',
  ...staffOnly,
  validate([
    query('status')
      .optional()
      .isIn([
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'RESCHEDULED',
        'COMPLETED',
        'CANCELLED',
      ])
      .withMessage('Invalid status filter'),
  ]),
  incoming
);

// My Referrals - MUST be above /:id
router.get('/mine', authenticate, authorize('PATIENT', 'HELPER'), mine);

// General referral routes
router.get('/:id', authenticate, getById);

router.post('/:id/cancel', authenticate, cancel);

router.get(
  '/:id/next-suggestions',
  authenticate,
  validate([
    query('lat').optional().isFloat({ min: -90, max: 90 }),
    query('lng').optional().isFloat({ min: -180, max: 180 }),
  ]),
  nextSuggestions
);

// Hospital staff status transitions
router.post(
  '/:id/accept',
  ...staffOnly,
  validate(acceptReferralValidation),
  accept
);

router.post(
  '/:id/reject',
  ...staffOnly,
  validate(rejectReferralValidation),
  reject
);

router.post(
  '/:id/reschedule',
  ...staffOnly,
  validate(rescheduleReferralValidation),
  reschedule
);

router.post(
  '/:id/complete',
  ...staffOnly,
  validate(completeReferralValidation),
  complete
);

export default router;
