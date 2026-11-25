import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { createPatientValidation } from './patient.validation';
import { createProfile, getMyProfile, getById } from './patient.controller';
const router = Router();

router.post('/me', authenticate, authorize('PATIENT'), validate(createPatientValidation), createProfile);
router.get('/me', authenticate, authorize('PATIENT'), getMyProfile);
// patient.routes.ts
router.get('/:id', authenticate, getById);
export default router;