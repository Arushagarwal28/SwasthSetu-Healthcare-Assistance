import { Request, Response, NextFunction } from 'express';
import { linkStaffToFacility } from './facility.service';

import {
  createFacility,
  listFacilities,
  getFacilityById,
} from './facility.service';

import {
  listFacilitiesForAdmin, updateFacility, removeFacilitySpecialty, unlinkStaffFromFacility,addFacilitySpecialty
} from './facility.admin.service';

import { AppError } from '../../middlewares/errorHandler';

export const create = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const facility = await createFacility(req.body);

    res.status(201).json({
      success: true,
      data: facility,
    });
  } catch (err) {
    next(err);
  }
};

export const list = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const facilities = await listFacilities();

    res.status(200).json({
      success: true,
      data: facilities,
    });
  } catch (err) {
    next(err);
  }
};

export const getById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new AppError('Invalid facility ID', 400));
    }

    const facility = await getFacilityById(id);

    res.status(200).json({
      success: true,
      data: facility,
    });
  } catch (err) {
    next(err);
  }
};

// facility.controller.ts
export const addSpecialty = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id || Array.isArray(id)) {
      return next(new AppError('Invalid facility ID', 400));
    }

    const result = await addFacilitySpecialty(id, req.body.specialty);

    res.status(201).json({
      success: true,
      data: result,
    });
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
  } catch (err) { next(err); }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, address, latitude, longitude, phone, isActive } = req.body;
    const data = await updateFacility(String(req.params.id), { name, type, address, latitude, longitude, phone, isActive });
    res.status(200).json({ success: true, data });
  } catch (err) { next(err); }
};

export const removeSpecialty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeFacilitySpecialty(String(req.params.id), String(req.params.specialty));
    res.status(200).json({ success: true, data: { message: 'Specialty removed' } });
  } catch (err) { next(err); }
};

export const unlinkStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await unlinkStaffFromFacility(String(req.params.id), String(req.params.userId));
    res.status(200).json({ success: true, data: { message: 'Staff member unlinked' } });
  } catch (err) { next(err); }
};