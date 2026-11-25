import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import {
  centresQueryValidation, createEntryValidation, createVaccineValidation, facilityIdValidation,
  notificationIdValidation, notificationsQueryValidation, runRemindersValidation,
  setCentreVaccinesValidation, updateCentreLocationValidation, updateEntryValidation,
  updateVaccineValidation, worklistQueryValidation,
} from './vaccination.validation';
import {
  adminCreateEntry, adminCreateVaccine, adminRunReminders, adminStats, adminUpdateEntry, adminUpdateVaccine,
  adminVaccines, centreDetail, centreLocation, centreSetVaccines, centres, myStats, notificationRead,
  notificationReadAll, notificationUnreadCount, notifications, schedule, worklist,
} from './vaccination.controller';

const router = Router();

const anyUser = [authenticate];
const staff = [authenticate, authorize('HELPER', 'HOSPITAL_STAFF')];
const centreManagers = [authenticate, authorize('ADMIN', 'HOSPITAL_STAFF')];
const admin = [authenticate, authorize('ADMIN')];

// In-app notifications (each user sees only their own)
router.get('/notifications', ...anyUser, validate(notificationsQueryValidation), notifications);
router.get('/notifications/unread-count', ...anyUser, notificationUnreadCount);
router.post('/notifications/read-all', ...anyUser, notificationReadAll);
router.patch('/notifications/:id/read', ...anyUser, validate(notificationIdValidation), notificationRead);

// Helper / hospital staff dashboards (limited to the children each can access)
router.get('/worklist', ...staff, validate(worklistQueryValidation), worklist);
router.get('/stats', ...staff, myStats);

// The schedule as new children get it (read-only)
router.get('/schedule', ...anyUser, schedule);

// Vaccination centres
router.get('/centres', ...anyUser, validate(centresQueryValidation), centres);
router.get('/centres/:facilityId', ...anyUser, validate(facilityIdValidation), centreDetail);
router.put('/centres/:facilityId/vaccines', ...centreManagers, validate(setCentreVaccinesValidation), centreSetVaccines);
router.patch('/centres/:facilityId/location', ...centreManagers, validate(updateCentreLocationValidation), centreLocation);

// Administrator: aggregate statistics and schedule management. No children's personal records.
router.get('/admin/stats', ...admin, adminStats);
router.get('/admin/vaccines', ...admin, adminVaccines);
router.post('/admin/vaccines', ...admin, validate(createVaccineValidation), adminCreateVaccine);
router.patch('/admin/vaccines/:id', ...admin, validate(updateVaccineValidation), adminUpdateVaccine);
router.post('/admin/vaccines/:id/entries', ...admin, validate(createEntryValidation), adminCreateEntry);
router.patch('/admin/schedule-entries/:id', ...admin, validate(updateEntryValidation), adminUpdateEntry);
router.post('/admin/reminders/run', ...admin, validate(runRemindersValidation), adminRunReminders);

export default router;
