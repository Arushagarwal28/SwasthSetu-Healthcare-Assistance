import { body, param, query } from 'express-validator';
import { PIN_CODE } from './child.utils';
import { AGE_UNITS, APPLICABILITY_RULES, VACCINE_CODE } from './schedule.admin.rules';

const page = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

export const notificationsQueryValidation = [
  query('unread').optional().isBoolean().withMessage('unread must be true or false'),
  ...page,
];

export const notificationIdValidation = [param('id').isUUID().withMessage('Valid notification id is required')];

export const worklistQueryValidation = [
  query('status').optional().isIn(['OVERDUE', 'DUE', 'UPCOMING', 'ALL']).withMessage('status must be OVERDUE, DUE, UPCOMING or ALL'),
  query('days').optional().isInt({ min: 1, max: 90 }).withMessage('days must be between 1 and 90'),
  query('search').optional().isString().isLength({ max: 100 }).withMessage('search must be at most 100 characters'),
  ...page,
];

export const centresQueryValidation = [
  query('q').optional().isString().isLength({ max: 100 }),
  query('district').optional().isString().isLength({ max: 100 }),
  query('pinCode').optional().matches(PIN_CODE).withMessage('pinCode must be a valid 6-digit PIN code'),
  query('vaccineCode').optional().isString().isLength({ max: 200 }).withMessage('vaccineCode must be a comma-separated list of codes'),
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('lat must be between -90 and 90'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180'),
  query('radiusKm').optional().isFloat({ min: 1, max: 500 }).withMessage('radiusKm must be between 1 and 500'),
  query('lat').custom((_v, { req }) => {
    if ((req.query?.lat === undefined) !== (req.query?.lng === undefined)) throw new Error('lat and lng must be given together');
    return true;
  }),
  ...page,
];

export const facilityIdValidation = [param('facilityId').isUUID().withMessage('Valid facility id is required')];

export const setCentreVaccinesValidation = [
  ...facilityIdValidation,
  body('vaccines').isArray({ max: 40 }).withMessage('vaccines must be a list'),
  body('vaccines.*.vaccineCode').isString().trim().toUpperCase().matches(VACCINE_CODE).withMessage('Each item needs a valid vaccineCode'),
  body('vaccines.*.sessionInfo').optional({ values: 'null' }).isString().trim().isLength({ max: 200 }).withMessage('sessionInfo must be at most 200 characters'),
];

export const updateCentreLocationValidation = [
  ...facilityIdValidation,
  body('district').optional().isString().trim().notEmpty().isLength({ max: 100 }).withMessage('district must be 1 to 100 characters'),
  body('pinCode').optional().trim().matches(PIN_CODE).withMessage('Enter a valid 6-digit PIN code'),
];

export const vaccineIdValidation = [param('id').isUUID().withMessage('Valid id is required')];

export const createVaccineValidation = [
  body('code').isString().trim().toUpperCase().matches(VACCINE_CODE).withMessage('code must be 2 to 20 characters: capital letters, digits, - or _, starting with a letter'),
  body('name').isString().trim().notEmpty().isLength({ max: 100 }).withMessage('name is required (at most 100 characters)'),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }).withMessage('description must be at most 500 characters'),
];

export const updateVaccineValidation = [
  ...vaccineIdValidation,
  body('code').not().exists().withMessage('A vaccine code cannot be changed'),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 100 }).withMessage('name must be 1 to 100 characters'),
  body('description').optional({ values: 'null' }).isString().trim().isLength({ max: 500 }).withMessage('description must be at most 500 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
];

export const createEntryValidation = [
  ...vaccineIdValidation,
  body('doseNumber').isInt({ min: 1, max: 20 }).withMessage('doseNumber must be between 1 and 20').toInt(),
  body('doseLabel').isString().trim().isLength({ min: 2, max: 60 }).withMessage('doseLabel must be 2 to 60 characters'),
  body('ageValue').isInt({ min: 0, max: 100000 }).withMessage('ageValue must be a whole number, 0 or more').toInt(),
  body('ageUnit').isIn(AGE_UNITS).withMessage(`ageUnit must be one of ${AGE_UNITS.join(', ')}`),
  body('ageLabel').isString().trim().isLength({ min: 1, max: 40 }).withMessage('ageLabel must be 1 to 40 characters'),
  body('applicability').optional().isIn(APPLICABILITY_RULES).withMessage(`applicability must be one of ${APPLICABILITY_RULES.join(', ')}`),
  body('sortOrder').optional().isInt({ min: 0, max: 10000 }).withMessage('sortOrder must be between 0 and 10000').toInt(),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('notes must be at most 300 characters'),
];

export const updateEntryValidation = [
  param('id').isUUID().withMessage('Valid id is required'),
  body('doseNumber').not().exists().withMessage('The dose number cannot be changed. Create a new entry instead.'),
  body('vaccineId').not().exists().withMessage('An entry cannot be moved to another vaccine'),
  body('doseLabel').optional().isString().trim().isLength({ min: 2, max: 60 }).withMessage('doseLabel must be 2 to 60 characters'),
  body('ageValue').optional().isInt({ min: 0, max: 100000 }).withMessage('ageValue must be a whole number, 0 or more').toInt(),
  body('ageUnit').optional().isIn(AGE_UNITS).withMessage(`ageUnit must be one of ${AGE_UNITS.join(', ')}`),
  body('ageLabel').optional().isString().trim().isLength({ min: 1, max: 40 }).withMessage('ageLabel must be 1 to 40 characters'),
  body('applicability').optional().isIn(APPLICABILITY_RULES).withMessage(`applicability must be one of ${APPLICABILITY_RULES.join(', ')}`),
  body('sortOrder').optional().isInt({ min: 0, max: 10000 }).withMessage('sortOrder must be between 0 and 10000').toInt(),
  body('isActive').optional().isBoolean().withMessage('isActive must be true or false').toBoolean(),
  body('notes').optional({ values: 'null' }).isString().trim().isLength({ max: 300 }).withMessage('notes must be at most 300 characters'),
];

export const runRemindersValidation = [
  body('asOf').optional().isISO8601().withMessage('asOf must be an ISO date-time, for example 2026-12-10T04:00:00Z'),
];
