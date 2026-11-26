import { body, query } from 'express-validator';
import { CORRECTION_FIELDS, TEST_STATUSES } from './report.types';

export const createReportValidation = [
  body('patientId').isUUID().withMessage('A valid patientId is required'),
  body('title').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('reportDate').optional({ values: 'falsy' }).isISO8601(),
  body('language').optional({ values: 'falsy' }).isIn(['en', 'hi']),
];

export const listReportsValidation = [
  query('q').optional().isString().isLength({ max: 80 }),
  query('status').optional().isIn(['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED']),
  query('reportType').optional().isString().isLength({ max: 40 }),
  query('patientId').optional().isUUID(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('needsReview').optional().isIn(['true', 'false']),
  query('sort').optional().isIn(['date', 'uploaded']),
  query('order').optional().isIn(['asc', 'desc']),
  query('page').optional().isInt({ min: 1, max: 10_000 }),
  query('pageSize').optional().isInt({ min: 1, max: 50 }),
];

export const correctionValidation = [
  body('corrections').isArray({ min: 1, max: 20 }).withMessage('corrections must be a non-empty list'),
  body('corrections.*.testId').isUUID(),
  body('corrections.*.field').isIn([...CORRECTION_FIELDS]),
  body('corrections.*.corrected').exists({ values: 'null' }).withMessage('A corrected value is required'),
  body('corrections.*.note').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
];

export const shareValidation = [
  body('userId').isUUID().withMessage('A valid userId is required'),
  body('expiresAt').optional({ values: 'falsy' }).isISO8601(),
];

export const shareTargetValidation = [
  query('q').isString().isLength({ min: 2, max: 80 }).withMessage('Search needs at least two characters'),
  query('page').optional().isInt({ min: 1, max: 500 }),
  query('pageSize').optional().isInt({ min: 1, max: 10 }),
];

export const compareValidation = [
  body('reportIds').isArray({ min: 2, max: 5 }).withMessage('Select between 2 and 5 reports'),
  body('reportIds.*').isUUID(),
];

export const historyValidation = [
  body('patientId').isUUID(),
  body('canonicalId').isString().isLength({ min: 1, max: 80 }),
];

/** Statuses accepted by the status label map (kept in sync by the type). */
export const KNOWN_STATUSES = TEST_STATUSES;
