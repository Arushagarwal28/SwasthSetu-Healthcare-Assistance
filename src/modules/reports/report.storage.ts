/**
 * Upload validation for medical reports.
 *
 * Files are held in memory only: nothing is written to disk, so the original
 * document cannot be retained, listed in a public directory or recovered after
 * the request finishes.
 */
import { AppError } from '../../middlewares/errorHandler';

export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export interface ValidatedUpload {
  buffer: Buffer;
  mimeType: AllowedMimeType;
  filename: string;
  sizeBytes: number;
}

export const maxUploadBytes = (): number => {
  const mb = Number(process.env.MEDICAL_REPORT_MAX_UPLOAD_MB);
  const safeMb = Number.isFinite(mb) && mb > 0 && mb <= 50 ? mb : 15;
  return Math.floor(safeMb * 1024 * 1024);
};

/** Detect the real file type from its bytes, ignoring the declared MIME type. */
export function sniffKind(buffer: Buffer): 'pdf' | 'png' | 'jpeg' | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('latin1') === 'PNG') return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  return null;
}

const MIME_FOR_KIND: Record<'pdf' | 'png' | 'jpeg', AllowedMimeType> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
};

/** Strip directories and control characters; keep a short, inert basename. */
export function sanitiseFilename(name: string | undefined): string {
  const base = (name || 'report')
    .replace(/\\/g, '/')
    .split('/')
    .pop() as string;
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[<>:"|?*]/g, '')
    .trim();
  return (cleaned || 'report').slice(0, 120);
}

export function validateUpload(file: Express.Multer.File | undefined): ValidatedUpload {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new AppError('A report file is required.', 422);
  }

  const limit = maxUploadBytes();
  if (file.buffer.length > limit) {
    throw new AppError(
      `The report is larger than the ${Math.floor(limit / (1024 * 1024))} MB limit.`,
      413
    );
  }

  const kind = sniffKind(file.buffer);
  if (!kind) {
    throw new AppError('Only PDF, PNG or JPEG medical reports are accepted.', 415);
  }

  const declared = (file.mimetype || '').toLowerCase();
  if (declared && !ALLOWED_MIME_TYPES.includes(declared as AllowedMimeType) && !declared.includes(kind)) {
    // A PNG announced as a PDF is a classic polyglot trick; trust the bytes.
    throw new AppError('The file type does not match its contents.', 415);
  }

  return {
    buffer: file.buffer,
    mimeType: MIME_FOR_KIND[kind],
    filename: sanitiseFilename(file.originalname),
    sizeBytes: file.buffer.length,
  };
}
