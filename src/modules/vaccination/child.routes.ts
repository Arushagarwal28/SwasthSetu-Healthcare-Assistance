import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { registerChildValidation, listChildrenValidation, childIdValidation } from './child.validation';
import { verifyChildAccessValidation } from './child.verify.validation';
import { recordDoseValidation, updateChildValidation, historyQueryValidation } from './dose.validation';
import { register, getById, list, verifyAccess, verifiedAccess } from './child.controller';
import { dashboard, history, recordDoseHandler, updateChild, childReminders, childCentres } from './child.care.controller';
import { childVerifyLimiter } from '../../middlewares/rateLimiters';
import { param } from 'express-validator';

const router = Router();

// Children's vaccination records are personal medical data: helpers and hospital
// staff only (ADMIN is deliberately excluded). What each can see is decided in child.access.ts.
const staffAndHelpers = [authenticate, authorize('HELPER', 'HOSPITAL_STAFF')];
const doseIdParam = [param('doseId').isUUID().withMessage('Valid dose id is required')];

router.post('/', ...staffAndHelpers, validate(registerChildValidation), register);
router.get('/', ...staffAndHelpers, validate(listChildrenValidation), list);

// Cross-facility verification: three identity fields plus a staff attestation of
// guardian permission. Rate-limited per account; all matching is server-side.
router.post(
  '/verify-access',
  authenticate,
  authorize('HOSPITAL_STAFF'),
  childVerifyLimiter,
  validate(verifyChildAccessValidation),
  verifyAccess
);
router.get('/verified-access', authenticate, authorize('HOSPITAL_STAFF'), verifiedAccess);

router.get('/:id', ...staffAndHelpers, validate(childIdValidation), getById);
router.patch('/:id', ...staffAndHelpers, validate([...childIdValidation, ...updateChildValidation]), updateChild);

router.get('/:id/dashboard', ...staffAndHelpers, validate(childIdValidation), dashboard);
router.get('/:id/history', ...staffAndHelpers, validate([...childIdValidation, ...historyQueryValidation]), history);
router.get('/:id/reminders', ...staffAndHelpers, validate(childIdValidation), childReminders);
router.get('/:id/centres', ...staffAndHelpers, validate(childIdValidation), childCentres);

router.patch(
  '/:id/doses/:doseId',
  ...staffAndHelpers,
  validate([...childIdValidation, ...doseIdParam, ...recordDoseValidation]),
  recordDoseHandler
);

export default router;
