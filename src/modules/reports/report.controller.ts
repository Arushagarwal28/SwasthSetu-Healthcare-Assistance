import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/errorHandler';
import { adminStatistics } from './report.admin.service';
import { comparePatientHistory, compareReports } from './report.compare.service';
import { correctReport } from './report.correction.service';
import { exportReportPdf } from './report.export.service';
import { reportTypeOptions, searchShareTargets } from './report.lookup.service';
import { listReports } from './report.query.service';
import { createReport, deleteReport, getReport, revokeShare, shareReport } from './report.service';

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const requestId = (req: AuthRequest): string | undefined => {
  const header = req.headers['x-request-id'];
  return typeof header === 'string' && header.length <= 100 ? header : undefined;
};

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await createReport({
      user: req.user!,
      patientId: String(req.body.patientId),
      title: text(req.body.title),
      reportDate: text(req.body.reportDate),
      language: text(req.body.language),
      file: req.file,
      requestId: requestId(req),
    });
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const list = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await listReports(req.user!, {
      q: text(req.query.q),
      status: text(req.query.status),
      reportType: text(req.query.reportType),
      patientId: text(req.query.patientId),
      from: text(req.query.from),
      to: text(req.query.to),
      needsReview:
        req.query.needsReview === undefined ? undefined : req.query.needsReview === 'true',
      sort: text(req.query.sort) === 'date' ? 'date' : 'uploaded',
      order: text(req.query.order) === 'asc' ? 'asc' : 'desc',
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    });
    res.status(200).json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await getReport(req.user!, String(req.params.id), requestId(req));
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const correct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const report = await correctReport(
      req.user!,
      String(req.params.id),
      req.body.corrections,
      requestId(req)
    );
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

export const share = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await shareReport(
      req.user!,
      String(req.params.id),
      String(req.body.userId),
      text(req.body.expiresAt)
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const unshare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await revokeShare(req.user!, String(req.params.id), String(req.params.userId));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await deleteReport(req.user!, String(req.params.id), requestId(req));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const compare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await compareReports(req.user!, req.body.reportIds, requestId(req));
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const compareHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await comparePatientHistory(
      req.user!,
      String(req.body.patientId),
      String(req.body.canonicalId),
      requestId(req)
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const exportPdf = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { buffer, filename } = await exportReportPdf(
      req.user!,
      String(req.params.id),
      requestId(req)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

/** Searchable hospital staff picker used by the sharing dialog. */
export const shareTargets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await searchShareTargets(req.user!, {
      q: text(req.query.q),
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || undefined,
    });
    res.status(200).json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) {
    next(error);
  }
};

/** Report types present among the reports this user may see. */
export const reportTypes = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await reportTypeOptions(req.user!);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const adminStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query.days) || 90;
    const data = await adminStatistics(days);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** Explicit guard used by tests and by future routes. */
export const notAvailableToAdmins = (_req: AuthRequest, _res: Response, next: NextFunction) => {
  next(new AppError('Administrators cannot access individual medical reports.', 403));
};
