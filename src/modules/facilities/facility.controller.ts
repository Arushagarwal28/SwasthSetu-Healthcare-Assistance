import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middlewares/errorHandler';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { linkStaffToFacility, createFacility, listFacilities, getFacilityById, listMyFacilities, listUnlinkedHospitalStaff } from './facility.service';
import {
  listFacilitiesForAdmin, updateFacility, removeFacilitySpecialty, unlinkStaffFromFacility, addFacilitySpecialty,
} from './facility.admin.service';
import {
  createRegistrationCode, rotateRegistrationCode, revokeRegistrationCode, setRegistrationCodeExpiry,
} from './facility.code.service';

const toExpiry = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  return new Date(String(value));
};

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await createFacility(req.body, req.user!.userId);
    res.status(201).json({
      success: true,
      data: {
        ...result.facility,
        // Shown once. It is not stored in plaintext and cannot be retrieved later.
        registrationCode: { code: result.registrationCode.code, expiresAt: result.registrationCode.expiresAt },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const list = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await listFacilities() });
  } catch (err) {
    next(err);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) return next(new AppError('Invalid facility ID', 400));
    res.status(200).json({ success: true, data: await getFacilityById(id) });
  } catch (err) {
    next(err);
  }
};

export const myFacilities = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'HOSPITAL_STAFF') {
      return next(new AppError('Only hospital staff have assigned facilities', 403));
    }
    res.status(200).json({ success: true, data: await listMyFacilities(req.user!.userId) });
  } catch (err) {
    next(err);
  }
};

export const addSpecialty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!id || Array.isArray(id)) return next(new AppError('Invalid facility ID', 400));
    const result = await addFacilitySpecialty(id, req.body.specialty);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const linkStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linkStaffToFacility(String(req.params.id), req.body.email);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const adminOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await listFacilitiesForAdmin() });
  } catch (err) {
    next(err);
  }
};

export const unlinkedStaff = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(200).json({ success: true, data: await listUnlinkedHospitalStaff() });
  } catch (err) {
    next(err);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, address, latitude, longitude, phone, isActive } = req.body;
    const data = await updateFacility(String(req.params.id), { name, type, address, latitude, longitude, phone, isActive });
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const removeSpecialty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeFacilitySpecialty(String(req.params.id), String(req.params.specialty));
    res.status(200).json({ success: true, data: { message: 'Specialty removed' } });
  } catch (err) {
    next(err);
  }
};

export const unlinkStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await unlinkStaffFromFacility(String(req.params.id), String(req.params.userId));
    res.status(200).json({ success: true, data: { message: 'Staff member unlinked' } });
  } catch (err) {
    next(err);
  }
};

// ---------- facility registration codes (ADMIN only) ----------

export const createFacilityCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const issued = await createRegistrationCode({
      facilityId: String(req.params.id),
      actorId: req.user!.userId,
      customCode: req.body?.code ?? null,
      expiresAt: toExpiry(req.body?.expiresAt),
    });
    res.status(201).json({
      success: true,
      data: { code: issued.code, expiresAt: issued.expiresAt },
    });
  } catch (err) {
    next(err);
  }
};

export const rotateFacilityCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const issued = await rotateRegistrationCode({
      facilityId: String(req.params.id),
      actorId: req.user!.userId,
      customCode: req.body?.code ?? null,
      expiresAt: toExpiry(req.body?.expiresAt),
    });
    res.status(200).json({
      success: true,
      data: { code: issued.code, expiresAt: issued.expiresAt },
    });
  } catch (err) {
    next(err);
  }
};

export const revokeFacilityCode = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await revokeRegistrationCode(String(req.params.id), req.user!.userId);
    res.status(200).json({ success: true, data: { message: 'Registration code revoked' } });
  } catch (err) {
    next(err);
  }
};

export const updateFacilityCodeExpiry = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await setRegistrationCodeExpiry(String(req.params.id), req.user!.userId, toExpiry(req.body?.expiresAt));
    res.status(200).json({ success: true, data: { message: 'Registration code expiry updated' } });
  } catch (err) {
    next(err);
  }
};
