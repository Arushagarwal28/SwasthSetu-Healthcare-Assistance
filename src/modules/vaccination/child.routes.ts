import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { registerChildValidation, listChildrenValidation, childIdValidation } from './child.validation';
import { recordDoseValidation, updateChildValidation, historyQueryValidation } from './dose.validation';
import { register, getById, list } from './child.controller';
import { dashboard, history, recordDoseHandler, updateChild, childReminders, childCentres } from './child.care.controller';
import { param } from 'express-validator';

const router = Router();

// Children's vaccination records are personal medical data: helpers and hospital
// staff only (ADMIN is deliberately excluded). What each can see is decided in child.access.ts.
const staffAndHelpers = [authenticate, authorize('HELPER', 'HOSPITAL_STAFF')];
const doseIdParam = [param('doseId').isUUID().withMessage('Valid dose id is required')];

router.post('/', ...staffAndHelpers, validate(registerChildValidation), register);
router.get('/', ...staffAndHelpers, validate(listChildrenValidation), list);

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
