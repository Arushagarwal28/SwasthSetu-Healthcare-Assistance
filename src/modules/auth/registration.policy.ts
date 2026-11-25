import crypto from 'crypto';
import { AppError } from '../../middlewares/errorHandler';

// Roles that need a shared reference code to self-register, and the env var
// holding that role's code. PATIENT is open; ADMIN is never self-registered.
const CODE_ENV: Record<string, { env: string; label: string }> = {
  HELPER: { env: 'HELPER_REFERENCE_CODE', label: 'PHC Reference Code' },
  HOSPITAL_STAFF: { env: 'HOSPITAL_STAFF_REFERENCE_CODE', label: 'Hospital Reference Code' },
};

// Hash both sides first so the comparison is constant-time and works for
// inputs of different lengths (timingSafeEqual needs equal-length buffers).
const codesMatch = (provided: string, expected: string): boolean => {
  const hash = (v: string) => crypto.createHash('sha256').update(v).digest();
  return crypto.timingSafeEqual(hash(provided), hash(expected));
};

/** Throws unless this role may self-register with the code provided. */
export const assertRegistrationAllowed = (role: string, providedCode?: string): void => {
  if (role === 'PATIENT') return;

  if (role === 'ADMIN') {
    throw new AppError('Admin accounts cannot be created through public registration', 403);
  }

  const rule = CODE_ENV[role];
  if (!rule) throw new AppError('Invalid role', 400);

  // Fails closed: if the code isn't configured, nobody can register for the role.
  const expected = process.env[rule.env];
  if (!expected || !providedCode || !codesMatch(providedCode, expected)) {
    throw new AppError(`Invalid ${rule.label}`, 403);
  }
};