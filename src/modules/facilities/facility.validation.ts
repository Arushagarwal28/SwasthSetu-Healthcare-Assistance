import { body } from 'express-validator';

export const createFacilityValidation = [
  body('name').notEmpty().withMessage('Facility name is required'),
  body('type').isIn(['PHC', 'CHC', 'HOSPITAL', 'CLINIC', 'OTHER']).withMessage('Invalid facility type'),
  body('address').notEmpty().withMessage('Address is required'),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('phone').optional().isString(),
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