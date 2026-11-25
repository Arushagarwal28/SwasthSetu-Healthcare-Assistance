import { body, query } from 'express-validator';
import { isValidYmd } from './vaccination.dates';
import { DOSE_ACTIONS } from './dose.rules';
import { INDIAN_MOBILE, PIN_CODE, normalizeIndianMobile } from './child.utils';

const optionalYmd = (field: string, label: string) =>
  body(field)
    .optional({ values: 'falsy' })
    .custom((v) => isValidYmd(String(v)))
    .withMessage(`${label} must be a real date in YYYY-MM-DD format`);

export const recordDoseValidation = [
  body('action').isIn(DOSE_ACTIONS).withMessage(`action must be one of ${DOSE_ACTIONS.join(', ')}`),
  optionalYmd('administeredOn', 'administeredOn'),
  optionalYmd('newDueDate', 'newDueDate'),
  body('note').optional({ values: 'falsy' }).isString().trim().isLength({ max: 300 }).withMessage('note must be at most 300 characters'),
  body('batchNumber').optional({ values: 'falsy' }).isString().trim().isLength({ max: 30 }).withMessage('batchNumber must be at most 30 characters'),
  body('facilityId').optional({ values: 'falsy' }).isUUID().withMessage('facilityId must be a valid id'),
];

const optionalNonEmpty = (field: string, max: number) =>
  body(field)
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage(`${field} cannot be empty`)
    .isLength({ max })
    .withMessage(`${field} must be at most ${max} characters`);

export const updateChildValidation = [
  body('guardianName').optional({ values: 'null' }).isString().trim().isLength({ max: 100 }),
  body('primaryMobile')
    .optional()
    .customSanitizer(normalizeIndianMobile)
    .matches(INDIAN_MOBILE)
    .withMessage('Enter a valid 10-digit Indian mobile number'),
  body('alternateMobile')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeIndianMobile)
    .matches(INDIAN_MOBILE)
    .withMessage('Alternate mobile must be a valid 10-digit Indian mobile number'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Invalid email'),
  optionalNonEmpty('addressLine', 200),
  optionalNonEmpty('village', 100),
  optionalNonEmpty('district', 100),
  optionalNonEmpty('state', 100),
  body('pinCode').optional().trim().matches(PIN_CODE).withMessage('Enter a valid 6-digit PIN code'),
  body('latitude')
    .custom((_v, { req }) => {
      const has = (k: string) => req.body[k] !== undefined;
      const set = (k: string) => req.body[k] !== undefined && req.body[k] !== null;
      if (has('latitude') !== has('longitude') || set('latitude') !== set('longitude')) {
        throw new Error('latitude and longitude must be given together (or both null to clear)');
      }
      return true;
    }),
  body('latitude').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('latitude must be between -90 and 90').toFloat(),
  body('longitude').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('longitude must be between -180 and 180').toFloat(),
  body('preferredLanguage').optional().isIn(['EN', 'HI']).withMessage('preferredLanguage must be EN or HI'),
  body('smsConsent').optional().isBoolean().withMessage('smsConsent must be true or false').toBoolean(),
];

export const historyQueryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be 1 or more'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
];
