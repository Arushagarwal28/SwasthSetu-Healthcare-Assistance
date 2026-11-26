/**
 * In-memory upload handling for medical reports.
 *
 * `memoryStorage` means the file never touches the filesystem: there is no
 * temporary file to clean up and nothing to leak into a public directory.
 */
import type { RequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../middlewares/errorHandler';
import { ALLOWED_MIME_TYPES, maxUploadBytes, type AllowedMimeType } from './report.storage';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxUploadBytes(),
    files: 1,
    fields: 12,
    parts: 14,
  },
  fileFilter: (_req, file, callback) => {
    const declared = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(declared as AllowedMimeType)) {
      callback(new AppError('Only PDF, PNG or JPEG medical reports are accepted.', 415));
      return;
    }
    callback(null, true);
  },
});

export const reportUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.REPORT_UPLOAD_RATE_LIMIT) || 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many report uploads. Please try again later.' },
    });
  },
});

/** Run multer and translate its errors into the project's error envelope. */
export const singleReportUpload: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError(
            `The report is larger than the ${Math.floor(maxUploadBytes() / (1024 * 1024))} MB limit.`,
            413
          )
        );
        return;
      }
      next(new AppError('The upload was not a valid single-file form.', 400));
      return;
    }
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new AppError('The upload could not be read.', 400));
  });
};
