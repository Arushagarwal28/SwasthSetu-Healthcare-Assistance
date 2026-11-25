import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { createReferral, getReferralById, getReferralByAssessment, cancelReferral } from './referral.service';
import {
  acceptReferral, rejectReferral, rescheduleReferral, completeReferral,
  getIncomingReferrals, getNextSuggestions,
} from './referral.service';
import { getMyReferrals } from './referral.mine.service';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const referral = await createReferral(
      req.user!,
      req.body.assessmentId,
      req.body.destinationFacilityId,
      req.body.notes
    );
    res.status(201).json({ success: true, data: referral });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const referral = await getReferralById(req.user!, String(req.params.id));
    res.status(200).json({ success: true, data: referral });
  } catch (err) {
    next(err);
  }
};

export const getByAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const referral = await getReferralByAssessment(req.user!, String(req.params.assessmentId));
    res.status(200).json({ success: true, data: referral });
  } catch (err) {
    next(err);
  }
};

export const cancel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const referral = await cancelReferral(req.user!, String(req.params.id));
    res.status(200).json({ success: true, data: referral });
  } catch (err) {
    next(err);
  }
};

export const incoming = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getIncomingReferrals(req.user!.userId, req.query.status as string | undefined);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const accept = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await acceptReferral(req.user!.userId, String(req.params.id), req.body.scheduledAt, req.body.note);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const reject = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await rejectReferral(req.user!.userId, String(req.params.id), req.body.reason);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const reschedule = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await rescheduleReferral(req.user!.userId, String(req.params.id), req.body.scheduledAt, req.body.note);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const complete = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await completeReferral(req.user!.userId, String(req.params.id), req.body.note);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const nextSuggestions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { lat, lng } = req.query;
    const coords =
      lat !== undefined && lng !== undefined
        ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) }
        : undefined;
    const data = await getNextSuggestions(req.user!, String(req.params.id), coords);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const mine = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getMyReferrals(req.user!);
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};