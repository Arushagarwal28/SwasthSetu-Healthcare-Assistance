import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { getChildDashboard, getChildHistory } from './dashboard.service';
import { recordDose } from './dose.service';
import { updateChildDetails } from './child.manage.service';
import { listChildReminders } from './reminder.service';
import { centresForChild } from './centre.service';

/** A single string query value, or undefined (Express may also give arrays or objects). */
export const queryString = (req: AuthRequest, key: string): string | undefined => {
  const v = req.query[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

export const queryInt = (req: AuthRequest, key: string, fallback: number, min: number, max: number): number => {
  const raw = queryString(req, key);
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
};

export const queryNumber = (req: AuthRequest, key: string): number | undefined => {
  const raw = queryString(req, key);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

export const dashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getChildDashboard(req.user!, String(req.params.id));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const history = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getChildHistory(req.user!, String(req.params.id), queryInt(req, 'page', 1, 1, 100000), queryInt(req, 'limit', 20, 1, 100));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const recordDoseHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const dose = await recordDose(req.user!, String(req.params.id), String(req.params.doseId), req.body);
    res.status(200).json({ success: true, data: dose });
  } catch (err) {
    next(err);
  }
};

export const updateChild = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const child = await updateChildDetails(req.user!, String(req.params.id), req.body);
    res.status(200).json({ success: true, data: child });
  } catch (err) {
    next(err);
  }
};

export const childReminders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await listChildReminders(req.user!, String(req.params.id), queryInt(req, 'limit', 60, 1, 200));
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const childCentres = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const codes = queryString(req, 'vaccineCode')?.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
    const data = await centresForChild(
      req.user!,
      String(req.params.id),
      codes,
      queryNumber(req, 'radiusKm'),
      queryInt(req, 'limit', 10, 1, 50)
    );
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
