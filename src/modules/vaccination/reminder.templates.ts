/**
 * Reminder message text, in English and Hindi. Pure functions.
 * These are reminders only: no medical advice, no dosing, nothing about health status.
 */
import type { ReminderKind } from './reminder.schedule';

export type Lang = 'EN' | 'HI';

/** 2026-11-22 -> 22-11-2026 */
export const formatDmy = (ymd: string): string => {
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
};

/** "A", "A and B", "A, B and C" (Hindi: और). */
export const joinNames = (names: string[], lang: Lang): string => {
  const and = lang === 'HI' ? 'और' : 'and';
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
};

export interface MessageInput {
  kind: ReminderKind;
  lang: Lang;
  childName: string;
  vaccineNames: string[];
  dueDate: string; // YYYY-MM-DD
}

export const templateKey = (kind: ReminderKind, lang: Lang): string =>
  `vaccine_reminder_${kind.toLowerCase()}_${lang.toLowerCase()}`;

const EN: Record<ReminderKind, (c: string, v: string, d: string) => string> = {
  TWO_DAYS_BEFORE: (c, v, d) => `SwasthSetu: ${c}'s ${v} vaccine is due on ${d}. Please visit your nearest vaccination centre.`,
  ONE_DAY_BEFORE: (c, v, d) => `SwasthSetu: ${c}'s ${v} vaccine is due tomorrow (${d}). Please visit your nearest vaccination centre.`,
  ON_DUE_DATE: (c, v, d) => `SwasthSetu: ${c}'s ${v} vaccine is due today (${d}). Please visit your nearest vaccination centre.`,
  ONE_DAY_AFTER: (c, v, d) => `SwasthSetu: ${c}'s ${v} vaccine was due on ${d} and has not been recorded yet. Please get it done as soon as possible.`,
};

const HI: Record<ReminderKind, (c: string, v: string, d: string) => string> = {
  TWO_DAYS_BEFORE: (c, v, d) => `स्वास्थ्यसेतु: ${c} का ${v} टीका ${d} को लगना है। कृपया नज़दीकी टीकाकरण केंद्र पर जाएँ।`,
  ONE_DAY_BEFORE: (c, v, d) => `स्वास्थ्यसेतु: ${c} का ${v} टीका कल (${d}) लगना है। कृपया नज़दीकी टीकाकरण केंद्र पर जाएँ।`,
  ON_DUE_DATE: (c, v, d) => `स्वास्थ्यसेतु: ${c} का ${v} टीका आज (${d}) लगना है। कृपया नज़दीकी टीकाकरण केंद्र पर जाएँ।`,
  ONE_DAY_AFTER: (c, v, d) => `स्वास्थ्यसेतु: ${c} का ${v} टीका ${d} को लगना था, पर अभी तक दर्ज नहीं हुआ है। कृपया जल्द से जल्द लगवाएँ।`,
};

export const buildSmsText = (i: MessageInput): string => {
  const table = i.lang === 'HI' ? HI : EN;
  return table[i.kind](i.childName, joinNames(i.vaccineNames, i.lang), formatDmy(i.dueDate));
};

const NOTIFICATION_TITLE: Record<ReminderKind, string> = {
  TWO_DAYS_BEFORE: 'Vaccination due in 2 days',
  ONE_DAY_BEFORE: 'Vaccination due tomorrow',
  ON_DUE_DATE: 'Vaccination due today',
  ONE_DAY_AFTER: 'Vaccination overdue',
};

/** In-app notifications are for staff and are always in English. */
export const buildNotification = (i: Omit<MessageInput, 'lang'>): { title: string; body: string } => ({
  title: NOTIFICATION_TITLE[i.kind],
  body: `${i.childName}: ${joinNames(i.vaccineNames, 'EN')} (due ${formatDmy(i.dueDate)})`,
});
