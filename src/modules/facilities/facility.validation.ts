import { body } from 'express-validator';

export const createFacilityValidation = [
  body('name').notEmpty().withMessage('Facility name is required'),
  body('type').isIn(['PHC', 'CHC', 'HOSPITAL', 'CLINIC', 'OTHER']).withMessage('Invalid facility type'),
  body('address').notEmpty().withMessage('Address is required'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('phone').optional().isString(),

  // A facility is only useful for staff registration once it has a code, so one
  // must be supplied here: either a custom code or a request to generate one.
  body('generateRegistrationCode')
    .optional()
    .isBoolean()
    .withMessage('generateRegistrationCode must be true or false')
    .toBoolean(),
  body('registrationCode')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('registrationCode must be text')
    .isLength({ max: 64 })
    .withMessage('registrationCode must be at most 64 characters'),
  body('registrationCode')
    .custom((value, { req }) => Boolean(value) || req.body.generateRegistrationCode === true)
    .withMessage('Enter a facility registration code or generate one'),
];

export const addSpecialtyValidation = [
  body('specialty').notEmpty().withMessage('Specialty is required'),
];

export const linkStaffValidation = [
  body('email').isEmail().withMessage('Valid staff email is required').normalizeEmail(),
];

export const updateFacilityValidation = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('type').optional().isIn(['PHC', 'CHC', 'HOSPITAL', 'CLINIC', 'OTHER']).withMessage('Invalid facility type'),
  body('address').optional().trim().notEmpty().withMessage('Address cannot be empty'),
  body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90').toFloat(),
  body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180').toFloat(),
  body('phone').optional({ nullable: true }).isString().isLength({ max: 30 }),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
];

const EXPIRY_MESSAGE = 'expiresAt must be a real date-time, or null to remove the expiry';

const expiryRule = body('expiresAt')
  .optional({ nullable: true })
  .custom((value) => value === null || value === '' || !Number.isNaN(Date.parse(String(value))))
  .withMessage(EXPIRY_MESSAGE);

const optionalCodeRule = body('code')
  .optional({ values: 'falsy' })
  .isString()
  .withMessage('code must be text')
  .isLength({ max: 64 })
  .withMessage('code must be at most 64 characters');

export const createFacilityCodeValidation = [optionalCodeRule, expiryRule];
export const rotateFacilityCodeValidation = [optionalCodeRule, expiryRule];
export const updateFacilityCodeExpiryValidation = [expiryRule];
