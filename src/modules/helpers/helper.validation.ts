import { body } from 'express-validator';

export const createHelperValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('phone').optional().isMobilePhone('any').withMessage('Invalid phone number'),
];

export const linkFacilityValidation = [
  body('facilityId').isUUID().withMessage('Valid facilityId is required'),
];

export const linkPatientValidation = [
  body('patientId').isUUID().withMessage('Valid patientId is required'),
];

export const registerPatientValidation = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Invalid gender'),
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit Indian mobile number'),
  body('email').optional().isEmail().withMessage('Invalid email'),
  body('address').optional().isString(),
];