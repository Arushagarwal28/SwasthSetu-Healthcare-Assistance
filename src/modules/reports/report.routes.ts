/**
 * Medical Report Simplifier routes.
 *
 * Every route is authenticated; ownership and sharing are enforced again in the
 * services, so a role check alone is never the only protection.
 */
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate';
import {
  adminStats,
  compare,
  compareHistory,
  correct,
  create,
  exportPdf,
  getById,
  list,
  remove,
  reportTypes,
  share,
  shareTargets,
  unshare,
} from './report.controller';
import { reportUploadLimiter, singleReportUpload } from './report.upload';
import {
  compareValidation,
  correctionValidation,
  createReportValidation,
  historyValidation,
  listReportsValidation,
  shareTargetValidation,
  shareValidation,
} from './report.validation';

const router = Router();

/** Medical data must never be cached by a browser or an intermediary. */
const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
};

router.use(authenticate, noStore);

/**
 * The staff picker is the only endpoint that searches accounts, so it carries
 * its own limit: enough for typing, too few to walk the whole directory.
 * Keyed per signed-in account rather than per IP (shared clinic networks).
 */
const shareTargetLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Keyed by account only: `authenticate` runs before this limiter, and using
  // the raw IP would need express-rate-limit's IPv6-safe helper.
  keyGenerator: (req) => (req as AuthRequest).user?.userId ?? 'anonymous',
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many staff searches. Please wait a moment and try again.' },
    });
  },
});

// Aggregate statistics: administrators only, never an individual report.
router.get('/admin/stats', authorize('ADMIN'), adminStats);

router.get('/', validate(listReportsValidation), list);

router.post(
  '/',
  authorize('PATIENT', 'HELPER'),
  reportUploadLimiter,
  singleReportUpload,
  validate(createReportValidation),
  create
);

router.get('/report-types', reportTypes);
router.get(
  '/share-targets',
  authorize('PATIENT', 'HELPER'),
  shareTargetLimiter,
  validate(shareTargetValidation),
  shareTargets
);

router.post('/compare', validate(compareValidation), compare);
router.post('/compare/history', validate(historyValidation), compareHistory);

router.get('/:id', getById);
router.get('/:id/export.pdf', exportPdf);

router.post('/:id/corrections', authorize('PATIENT', 'HELPER'), validate(correctionValidation), correct);

router.post('/:id/share', authorize('PATIENT', 'HELPER'), validate(shareValidation), share);
router.delete('/:id/share/:userId', authorize('PATIENT', 'HELPER'), unshare);

router.delete('/:id', authorize('PATIENT', 'HELPER'), remove);

export default router;
