import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import {
  createHelperProfile,
  getHelperProfile,
  linkHelperToFacility,
  linkHelperToPatient,
  getAuthorizedPatients,
  registerPatientByHelper,
} from './helper.service';

export const createProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const helper = await createHelperProfile(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: helper });
  } catch (err) {
    next(err);
  }
};

export const getMyProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const helper = await getHelperProfile(req.user!.userId);
    res.status(200).json({ success: true, data: helper });
  } catch (err) {
    next(err);
  }
};

export const linkFacility = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const link = await linkHelperToFacility(req.user!.userId, req.body.facilityId);
    res.status(201).json({ success: true, data: link });
  } catch (err) {
    next(err);
  }
};

export const linkPatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const link = await linkHelperToPatient(req.user!.userId, req.body.patientId);
    res.status(201).json({ success: true, data: link });
  } catch (err) {
    next(err);
  }
};

export const myPatients = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patients = await getAuthorizedPatients(req.user!.userId);
    res.status(200).json({ success: true, data: patients });
  } catch (err) {
    next(err);
  }
};

export const registerPatient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patient = await registerPatientByHelper(req.user!.userId, req.body);
    res.status(201).json({ success: true, data: patient });
  } catch (err) {
    next(err);
  }
};