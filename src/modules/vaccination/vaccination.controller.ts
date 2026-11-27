import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/errorHandler';
import { queryInt, queryNumber, queryString } from './child.care.controller';
import {
  listNotifications, markAllNotificationsRead, markNotificationRead, unreadCount,
} from './notification.service';
import { getWorklist } from './worklist.service';
import type { WorklistStatus } from './worklist.service';
import { getAdminStats, getScopeStats } from './statistics.service';
import { getCentre, searchCentres, setCentreVaccines, updateCentreLocation } from './centre.service';
import type { CentreFilters } from './centre.search';
import {
  createEntry, createVaccine, getActiveSchedule, listVaccinesForAdmin, updateEntry, updateVaccine,
} from './schedule.admin.service';
import { runReminderCycle } from './reminder.scheduler';

type Handler = (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data });
const wrap = (fn: (req: AuthRequest, res: Response) => Promise<void>): Handler => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

// ---------- notifications ----------
export const notifications = wrap(async (req, res) => {
  const data = await listNotifications(
    req.user!.userId,
    queryString(req, 'unread') === 'true',
    queryInt(req, 'page', 1, 1, 100000),
    queryInt(req, 'limit', 20, 1, 100)
  );
  ok(res, data);
});
export const notificationUnreadCount = wrap(async (req, res) => {
  ok(res, { unread: await unreadCount(req.user!.userId) });
});
export const notificationRead = wrap(async (req, res) => {
  await markNotificationRead(req.user!.userId, String(req.params.id));
  ok(res, { read: true });
});
export const notificationReadAll = wrap(async (req, res) => {
  ok(res, { marked: await markAllNotificationsRead(req.user!.userId) });
});

// ---------- worklist and statistics ----------
export const worklist = wrap(async (req, res) => {
  const status = (queryString(req, 'status') ?? 'ALL') as WorklistStatus;
  const data = await getWorklist(req.user!, {
    status,
    days: queryInt(req, 'days', 7, 1, 90),
    page: queryInt(req, 'page', 1, 1, 100000),
    limit: queryInt(req, 'limit', 25, 1, 100),
    search: queryString(req, 'search'),
  });
  ok(res, data);
});
export const myStats = wrap(async (req, res) => {
  ok(res, await getScopeStats(req.user!));
});
export const adminStats = wrap(async (_req, res) => {
  ok(res, await getAdminStats());
});

// ---------- centres ----------
export const centres = wrap(async (req, res) => {
  const filters: CentreFilters = {
    q: queryString(req, 'q'),
    district: queryString(req, 'district'),
    pinCode: queryString(req, 'pinCode'),
    vaccineCodes: queryString(req, 'vaccineCode')?.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
    lat: queryNumber(req, 'lat'),
    lng: queryNumber(req, 'lng'),
    radiusKm: queryNumber(req, 'radiusKm'),
  };
  ok(res, await searchCentres(filters, queryInt(req, 'page', 1, 1, 100000), queryInt(req, 'limit', 20, 1, 100)));
});
export const centreDetail = wrap(async (req, res) => {
  ok(res, await getCentre(String(req.params.facilityId)));
});
export const centreSetVaccines = wrap(async (req, res) => {
  ok(res, await setCentreVaccines(req.user!, String(req.params.facilityId), req.body.vaccines));
});
export const centreLocation = wrap(async (req, res) => {
  ok(res, await updateCentreLocation(req.user!, String(req.params.facilityId), req.body));
});

// ---------- schedule ----------
export const schedule = wrap(async (_req, res) => {
  ok(res, await getActiveSchedule());
});
export const adminVaccines = wrap(async (_req, res) => {
  ok(res, await listVaccinesForAdmin());
});
export const adminCreateVaccine = wrap(async (req, res) => {
  ok(res, await createVaccine(req.body), 201);
});
export const adminUpdateVaccine = wrap(async (req, res) => {
  ok(res, await updateVaccine(String(req.params.id), req.body));
});
export const adminCreateEntry = wrap(async (req, res) => {
  ok(res, await createEntry(String(req.params.id), req.body), 201);
});
export const adminUpdateEntry = wrap(async (req, res) => {
  ok(res, await updateEntry(String(req.params.id), req.body));
});

// ---------- run the reminder engine now (admin; for testing and demos) ----------
export const adminRunReminders = wrap(async (req, res) => {
  const asOf = req.body?.asOf as string | undefined;
  if (asOf && process.env.NODE_ENV === 'production') {
    throw new AppError('asOf is only available outside production', 400);
  }
  const stats = await runReminderCycle(asOf ? new Date(asOf) : new Date());
  ok(res, stats);
});
