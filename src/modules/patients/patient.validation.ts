import { body } from 'express-validator';

export const createPatientValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Invalid gender'),
  body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
  body('address').optional().isString(),
];