import { param } from 'express-validator';
import { updateFacilityValidation } from './facility.validation';
import { adminOverview, update, removeSpecialty, unlinkStaff } from './facility.controller';
import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import { createFacilityValidation,  addSpecialtyValidation, } from './facility.validation';
import { create,list,getById,addSpecialty,} from './facility.controller';
import { linkStaffValidation } from './facility.validation';
import { linkStaff } from './facility.controller';
const router = Router();
// facility.routes.ts
router.get('/admin/overview', authenticate, authorize('ADMIN'), adminOverview);
router.patch('/:id', authenticate, authorize('ADMIN'),
  validate([param('id').isUUID(), ...updateFacilityValidation]), update);
router.delete('/:id/specialties/:specialty', authenticate, authorize('ADMIN'),
  validate([param('id').isUUID()]), removeSpecialty);
router.delete('/:id/staff/:userId', authenticate, authorize('ADMIN'),
  validate([param('id').isUUID(), param('userId').isUUID()]), unlinkStaff);
router.post(
  '/:id/specialties',
  authenticate,
  authorize('ADMIN'),
  validate(addSpecialtyValidation),
  addSpecialty
);router.post('/', authenticate, authorize('ADMIN'), validate(createFacilityValidation), create);
router.get('/', authenticate, list);
router.get('/:id', authenticate, getById);
router.post('/:id/staff', authenticate, authorize('ADMIN'), validate(linkStaffValidation), linkStaff);
export default router;