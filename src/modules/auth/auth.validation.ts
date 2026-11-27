import { body } from 'express-validator';

export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),

  // Public registration is limited to these roles. ADMIN is created separately.
  body('role')
    .isIn(['PATIENT', 'HELPER', 'HOSPITAL_STAFF'])
    .withMessage('Invalid role'),

  // Helpers use the shared PHC reference code. New clients send referenceCode;
  // retain phcReferenceCode for older clients.
  body('referenceCode')
    .if(body('role').equals('HELPER'))
    .custom((value, { req }) => Boolean(value || req.body.phcReferenceCode))
    .withMessage('A reference code is required for this role'),

  // Hospital staff are authorized by their facility's own registration code.
  body('facilityRegistrationCode')
    .if(body('role').equals('HOSPITAL_STAFF'))
    .custom((value) => typeof value === 'string' && value.trim() !== '')
    .withMessage('Facility registration code is required'),

  body('fullName')
    .if(body('role').equals('HELPER'))
    .trim()
    .notEmpty()
    .withMessage('Full name is required for Helper registration'),

  body('phone')
    .if(body('role').equals('HELPER'))
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Enter a valid 10-digit Indian mobile number'),
];

export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];
