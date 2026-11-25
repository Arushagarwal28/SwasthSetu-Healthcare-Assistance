import { body, param, query } from 'express-validator';
import { isValidYmd } from './vaccination.dates';
import { INDIAN_MOBILE, PIN_CODE, normalizeIndianMobile } from './child.utils';

const present = (v: unknown) => v !== undefined && v !== null && v !== '';

const requiredText = (field: string, label: string, max: number) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${label} is required`)
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

const optionalText = (field: string, label: string, max: number) =>
  body(field)
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max })
    .withMessage(`${label} must be at most ${max} characters`);

export const registerChildValidation = [
  // --- the child ---
  requiredText('fullName', 'Child name', 100),
  body('dateOfBirth')
    .custom((v) => isValidYmd(String(v)))
    .withMessage('dateOfBirth must be a real date in YYYY-MM-DD format'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('gender must be MALE, FEMALE or OTHER'),
  body('birthWeightGrams')
    .optional({ values: 'null' })
    .isInt({ min: 300, max: 7000 })
    .withMessage('birthWeightGrams must be between 300 and 7000')
    .toInt(),

  // --- parents / guardian / contact ---
  requiredText('motherName', "Mother's name", 100),
  requiredText('fatherName', "Father's name", 100),
  optionalText('guardianName', "Guardian's name", 100),
  body('primaryMobile')
    .customSanitizer(normalizeIndianMobile)
    .matches(INDIAN_MOBILE)
    .withMessage('Enter a valid 10-digit Indian mobile number'),
  body('alternateMobile')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeIndianMobile)
    .matches(INDIAN_MOBILE)
    .withMessage('Alternate mobile must be a valid 10-digit Indian mobile number'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email'),

  // --- address ---
  requiredText('addressLine', 'Address', 200),
  requiredText('village', 'Village / town', 100),
  requiredText('district', 'District', 100),
  requiredText('state', 'State', 100),
  body('pinCode').trim().matches(PIN_CODE).withMessage('Enter a valid 6-digit PIN code'),
  body('latitude')
    .custom((_v, { req }) => {
      if (present(req.body.latitude) !== present(req.body.longitude)) {
        throw new Error('latitude and longitude must be given together');
      }
      return true;
    }),
  body('latitude')
    .optional({ values: 'null' })
    .isFloat({ min: -90, max: 90 })
    .withMessage('latitude must be between -90 and 90')
    .toFloat(),
  body('longitude')
    .optional({ values: 'null' })
    .isFloat({ min: -180, max: 180 })
    .withMessage('longitude must be between -180 and 180')
    .toFloat(),

  // --- vaccination settings ---
  body('jeEndemicArea').optional().isBoolean().withMessage('jeEndemicArea must be true or false').toBoolean(),
  body('preferredLanguage').optional().isIn(['EN', 'HI']).withMessage('preferredLanguage must be EN or HI'),
  body('smsConsent').optional().isBoolean().withMessage('smsConsent must be true or false').toBoolean(),
  body('facilityId').optional({ values: 'falsy' }).isUUID().withMessage('facilityId must be a valid id'),
  body('confirmDuplicate').optional().isBoolean().withMessage('confirmDuplicate must be true or false').toBoolean(),

  // --- vaccines the child already received ---
  body('history').optional().isArray({ max: 40 }).withMessage('history must be a list of at most 40 doses'),
  body('history.*.vaccineCode')
    .isString()
    .trim()
    .toUpperCase()
    .notEmpty()
    .withMessage('Each history row needs a vaccineCode'),
  body('history.*.doseNumber').isInt({ min: 1, max: 20 }).withMessage('Each history row needs a doseNumber').toInt(),
  body('history.*.administeredOn')
    .custom((v) => isValidYmd(String(v)))
    .withMessage('Each history row needs administeredOn as YYYY-MM-DD'),
];

export const listChildrenValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];

export const childIdValidation = [param('id').isUUID().withMessage('Valid child id is required')];
