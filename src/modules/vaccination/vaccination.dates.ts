
/**
 * Calendar-date helpers. Vaccination dates are DATES, not instants, so they are
 * handled as 'YYYY-MM-DD' strings in Indian Standard Time (UTC+05:30, no DST).
 * Avoiding JS Date-with-timezone arithmetic is what keeps due dates from
 * drifting by a day.
 */
export type AgeUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';

const IST_OFFSET_MINUTES = 330;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

const toUtcDate = (s: string): Date => {
  const parts = s.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;

  return new Date(Date.UTC(y, m - 1, d));
};

const fromUtcDate = (d: Date): string => d.toISOString().slice(0, 10);

export const isValidYmd = (s: string): boolean => {
  const m = YMD.exec(s);
  if (!m) return false;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  const dt = new Date(Date.UTC(y, mo - 1, d));

  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === mo - 1 &&
    dt.getUTCDate() === d
  );
};

/** Today's calendar date in India. */
export const todayInIst = (now: Date = new Date()): string =>
  fromUtcDate(new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000));

export const addDays = (ymd: string, days: number): string => {
  const d = toUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
};

/** Adds calendar months, clamping to the last day of a shorter month (31 Aug + 6m = 28 Feb). */
export const addMonths = (ymd: string, months: number): string => {
  const parts = ymd.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;

  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();

  return fromUtcDate(new Date(Date.UTC(ny, nm, Math.min(d, lastDay))));
};

export const addYears = (ymd: string, years: number): string =>
  addMonths(ymd, years * 12);

/** The date a child reaches a given age. */
export const addAge = (dob: string, value: number, unit: AgeUnit): string => {
  switch (unit) {
    case 'DAYS':
      return addDays(dob, value);
    case 'WEEKS':
      return addDays(dob, value * 7);
    case 'MONTHS':
      return addMonths(dob, value);
    case 'YEARS':
      return addYears(dob, value);
  }
};

export const daysBetween = (fromYmd: string, toYmd: string): number =>
  Math.round(
    (toUtcDate(toYmd).getTime() - toUtcDate(fromYmd).getTime()) / 86_400_000
  );

/** The UTC instant of a given wall-clock time in IST, e.g. 09:00 IST on a date. */
export const istDateTime = (
  ymd: string,
  hour: number,
  minute = 0
): Date => {
  const parts = ymd.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;

  return new Date(
    Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MINUTES * 60_000
  );
};
