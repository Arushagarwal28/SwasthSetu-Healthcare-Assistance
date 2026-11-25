import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { createPatientProfile, getPatientProfile,  getPatientById } from './patient.service';

export const createProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patient = await createPatientProfile(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patient = await getPatientProfile(req.user!.userId);
    res.status(200).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new Error('Invalid patient ID'));
    }

    const patient = await getPatientById(req.user!, id);

    res.status(200).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};