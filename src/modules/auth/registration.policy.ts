import crypto from 'crypto';
import { AppError } from '../../middlewares/errorHandler';

// Only the HELPER role still uses a shared reference code. HOSPITAL_STAFF
// registration is authorized by a facility-specific registration code that is
// verified against the database inside the registration transaction, so there
// is no global hospital code left that could bypass facility scoping.
const HELPER_CODE_ENV = 'HELPER_REFERENCE_CODE';

const SELF_REGISTRABLE = new Set(['PATIENT', 'HELPER', 'HOSPITAL_STAFF']);

// Hash both sides first so the comparison is constant-time and works for
// inputs of different lengths (timingSafeEqual needs equal-length buffers).
const codesMatch = (provided: string, expected: string): boolean => {
  const hash = (v: string) => crypto.createHash('sha256').update(v).digest();
  return crypto.timingSafeEqual(hash(provided), hash(expected));
};

/** Throws unless this role may self-register with the credentials provided. */
export const assertRegistrationAllowed = (role: string, providedCode?: string): void => {
  if (role === 'ADMIN') {
    throw new AppError('Admin accounts cannot be created through public registration', 403);
  }
  if (!SELF_REGISTRABLE.has(role)) throw new AppError('Invalid role', 400);

  // PATIENT is open; HOSPITAL_STAFF is checked against a facility code later.
  if (role !== 'HELPER') return;

  // Fails closed: if the code isn't configured, nobody can register as a helper.
  const expected = process.env[HELPER_CODE_ENV];
  if (!expected || !providedCode || !codesMatch(providedCode, expected)) {
    throw new AppError('Invalid PHC Reference Code', 403);
  }
};
