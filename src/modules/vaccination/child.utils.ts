/**
 * Small pure helpers for child registration: no database, no Express,
 * so they are easy to test (see child.utils.test.ts).
 */

export const INDIAN_MOBILE = /^[6-9]\d{9}$/;
export const PIN_CODE = /^[1-9]\d{5}$/;

/** "+91 98765-43210", "919876543210" and "09876543210" all become "9876543210". */
export const normalizeIndianMobile = (value: unknown): string => {
  const compact = String(value ?? '').replace(/[\s\-()]/g, '');
  return compact.replace(/^(?:\+91|91|0)(?=\d{10}$)/, '');
};

/** Trims, collapses repeated spaces, and turns empty input into null. */
export const cleanText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  return text === '' ? null : text;
};

/** The human-friendly record ID shown to staff, e.g. SSV-000123. */
export const formatRecordNumber = (n: number): string => `SSV-${String(n).padStart(6, '0')}`;

/**
 * Reads a record number typed by staff: "SSV-000123", "ssv 123" or "000123"
 * all become 123. Anything else (including wildcards) is rejected, so the lookup
 * can never be turned into a partial or range search.
 */
export const parseRecordNumber = (value: unknown): number | null => {
  const text = String(value ?? '').trim().toUpperCase().replace(/[\s-]/g, '');
  const match = /^(?:SSV)?(\d{1,9})$/.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Prisma @db.Date columns come back as a Date at UTC midnight. */
export const toYmd = (d: Date): string => d.toISOString().slice(0, 10);
export const ymdToDate = (ymd: string): Date => new Date(`${ymd}T00:00:00.000Z`);

// ---------- duplicate detection ----------

export type DuplicateReason = 'SAME_MOBILE' | 'SAME_MOTHER' | 'SAME_FATHER' | 'SAME_CHILD_NAME';

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Why an existing child (already known to have the SAME date of birth) looks like
 * the child being registered. An empty list means "not a possible duplicate".
 * A match is only a warning: twins legitimately share DOB, phone and parents.
 */
export const duplicateReasons = (
  existing: {
    fullName: string;
    motherName: string;
    fatherName: string;
    primaryMobile: string;
    alternateMobile: string | null;
  },
  incoming: { fullName: string; motherName: string; fatherName: string; mobiles: string[] }
): DuplicateReason[] => {
  const reasons: DuplicateReason[] = [];
  const existingMobiles = [existing.primaryMobile, existing.alternateMobile].filter(
    (m): m is string => !!m
  );
  if (incoming.mobiles.some((m) => existingMobiles.includes(m))) reasons.push('SAME_MOBILE');
  if (norm(existing.motherName) === norm(incoming.motherName)) reasons.push('SAME_MOTHER');
  if (norm(existing.fatherName) === norm(incoming.fatherName)) reasons.push('SAME_FATHER');
  if (norm(existing.fullName) === norm(incoming.fullName)) reasons.push('SAME_CHILD_NAME');
  return reasons;
};
