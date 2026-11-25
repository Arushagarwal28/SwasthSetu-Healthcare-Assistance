import { Request, Response, NextFunction } from 'express';
import { getAllSymptoms } from './symptom.service';

export const getSymptoms = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const symptoms = await getAllSymptoms();

    res.status(200).json({
      success: true,
      data: symptoms,
    });
  } catch (err) {
    next(err);
  }
};