import { body } from 'express-validator';

export const createReferralValidation = [
  body('assessmentId').isUUID().withMessage('Valid assessmentId is required'),
  body('destinationFacilityId').isUUID().withMessage('Valid destinationFacilityId is required'),
  body('notes').optional().isString(),
];

const futureDate = (value: string) => {
  if (new Date(value) <= new Date()) throw new Error('Date-time must be in the future');
  return true;
};

export const acceptReferralValidation = [
  body('scheduledAt').optional().isISO8601().withMessage('scheduledAt must be a valid date-time').custom(futureDate),
  body('note').optional().isString().isLength({ max: 500 }),
];

export const rejectReferralValidation = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('A reason is required when rejecting a referral')
    .isLength({ max: 500 }),
];

export const rescheduleReferralValidation = [
  body('scheduledAt').isISO8601().withMessage('A valid new date-time is required').custom(futureDate),
  body('note').optional().isString().isLength({ max: 500 }),
];

export const completeReferralValidation = [
  body('note').optional().isString().isLength({ max: 500 }),
];