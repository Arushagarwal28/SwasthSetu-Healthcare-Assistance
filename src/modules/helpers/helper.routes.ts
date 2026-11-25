import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { createHelperValidation, linkFacilityValidation, linkPatientValidation,registerPatientValidation } from './helper.validation';
import { createProfile, getMyProfile, linkFacility, linkPatient, myPatients,registerPatient } from './helper.controller';

const router = Router();

router.post('/me', authenticate, authorize('HELPER'), validate(createHelperValidation), createProfile);
router.get('/me', authenticate, authorize('HELPER'), getMyProfile);
router.post('/me/facilities', authenticate, authorize('HELPER'), validate(linkFacilityValidation), linkFacility);
router.post('/me/patients', authenticate, authorize('HELPER'), validate(linkPatientValidation), linkPatient);
router.get('/me/patients', authenticate, authorize('HELPER'), myPatients);
router.post(
  '/me/patients/new',
  authenticate,
  authorize('HELPER'),
  validate(registerPatientValidation),
  registerPatient
);
export default router;