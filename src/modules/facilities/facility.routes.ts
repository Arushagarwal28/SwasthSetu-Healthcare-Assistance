import { Router } from 'express';
import { param } from 'express-validator';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import {
  addSpecialtyValidation, createFacilityCodeValidation, createFacilityValidation,
  linkStaffValidation, rotateFacilityCodeValidation, updateFacilityCodeExpiryValidation,
  updateFacilityValidation,
} from './facility.validation';
import {
  addSpecialty, adminOverview, create, createFacilityCode, getById, linkStaff, list, myFacilities,
  removeSpecialty, revokeFacilityCode, rotateFacilityCode, unlinkedStaff, unlinkStaff, update,
  updateFacilityCodeExpiry,
} from './facility.controller';

const router = Router();
const admin = [authenticate, authorize('ADMIN')];

// Administrator views (must be declared before /:id so they are not read as ids)
router.get('/admin/overview', ...admin, adminOverview);
router.get('/admin/unlinked-staff', ...admin, unlinkedStaff);

// A hospital staff member's own assigned facilities (never registration codes)
router.get('/mine', authenticate, myFacilities);

router.post('/', ...admin, validate(createFacilityValidation), create);

// Registration code lifecycle: create, rotate, revoke, change expiry
router.post('/:id/registration-code', ...admin, validate([param('id').isUUID(), ...createFacilityCodeValidation]), createFacilityCode);
router.post('/:id/registration-code/rotate', ...admin, validate([param('id').isUUID(), ...rotateFacilityCodeValidation]), rotateFacilityCode);
router.post('/:id/registration-code/revoke', ...admin, validate([param('id').isUUID()]), revokeFacilityCode);
router.patch('/:id/registration-code', ...admin, validate([param('id').isUUID(), ...updateFacilityCodeExpiryValidation]), updateFacilityCodeExpiry);

router.patch('/:id', ...admin, validate([param('id').isUUID(), ...updateFacilityValidation]), update);
router.delete('/:id/specialties/:specialty', ...admin, validate([param('id').isUUID()]), removeSpecialty);
router.delete('/:id/staff/:userId', ...admin, validate([param('id').isUUID(), param('userId').isUUID()]), unlinkStaff);
router.post('/:id/specialties', ...admin, validate(addSpecialtyValidation), addSpecialty);

router.post('/:id/staff', ...admin, validate(linkStaffValidation), linkStaff);
router.get('/', authenticate, list);
router.get('/:id', authenticate, getById);

export default router;
