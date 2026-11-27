import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { getChildProfile, listChildren, registerChild } from './child.service';
import { listVerifiedAccess, verifyChildAccess } from './child.verify.service';

export const register = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await registerChild(req.user!, req.body);

    if (result.status === 'POSSIBLE_DUPLICATES') {
      res.status(409).json({
        success: false,
        code: 'POSSIBLE_DUPLICATES',
        message:
          'A child with the same date of birth and matching details is already registered. ' +
          'If this is a different child (for example a twin), send the request again with confirmDuplicate: true.',
        data: { matches: result.matches },
      });
      return;
    }
    if (result.status === 'INVALID') {
      res.status(400).json({
        success: false,
        code: 'INVALID_CHILD_DATA',
        message: 'Please correct the following problems',
        errors: result.errors,
      });
      return;
    }
    res.status(201).json({ success: true, data: result.child });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const child = await getChildProfile(req.user!, String(req.params.id));
    res.status(200).json({ success: true, data: child });
  } catch (err) {
    next(err);
  }
};

export const verifyAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await verifyChildAccess(req.user!, {
      recordNumber: String(req.body.recordNumber),
      guardianMobile: String(req.body.guardianMobile),
      dateOfBirth: String(req.body.dateOfBirth),
      guardianConsentConfirmed: req.body.guardianConsentConfirmed === true,
      facilityId: req.body.facilityId ? String(req.body.facilityId) : null,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const verifiedAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await listVerifiedAccess(req.user!) });
  } catch (err) {
    next(err);
  }
};

export const list = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const data = await listChildren(req.user!, page, limit);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
