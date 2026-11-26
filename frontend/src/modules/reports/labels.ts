/** User-facing wording shared by the Medical Report Simplifier screens. */
import type {
  ExplanationLanguage,
  ReportProcessingStatus,
  TestStatus,
} from './types';
import { formatYmd } from '../../utils/date';

/** Accepts the ISO timestamp the API returns and shows just the calendar date. */
export const formatReportDate = (value: string | null | undefined): string =>
  value ? formatYmd(value.slice(0, 10)) : '—';

export const LANGUAGE_LABEL: Record<ExplanationLanguage, string> = {
  en: 'English',
  hi: 'हिंदी',
};

export const PROCESSING_LABEL: Record<ReportProcessingStatus, string> = {
  UPLOADED: 'Queued',
  PROCESSING: 'Processing',
  COMPLETED: 'Ready',
  FAILED: 'Could not be processed',
};

/**
 * Each status carries a glyph as well as text and colour, so a result is never
 * communicated by colour alone.
 */
export const TEST_STATUS_STYLE: Record<
  TestStatus,
  { glyph: string; en: string; hi: string; className: string }
> = {
  WITHIN_RANGE: {
    glyph: '✓',
    en: 'Within the printed range',
    hi: 'छपी हुई सीमा के भीतर',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  HIGH: {
    glyph: '↑',
    en: 'Above the printed range',
    hi: 'छपी हुई सीमा से अधिक',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  LOW: {
    glyph: '↓',
    en: 'Below the printed range',
    hi: 'छपी हुई सीमा से कम',
    className: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  ABNORMAL: {
    glyph: '!',
    en: 'Reported as abnormal',
    hi: 'असामान्य बताया गया',
    className: 'border-rose-300 bg-rose-50 text-rose-900',
  },
  UNKNOWN: {
    glyph: '?',
    en: 'Cannot be compared with a range',
    hi: 'सीमा से तुलना नहीं की जा सकती',
    className: 'border-slate-300 bg-slate-50 text-slate-700',
  },
  NEEDS_REVIEW: {
    glyph: '⚠',
    en: 'Needs manual verification',
    hi: 'मैन्युअल जाँच आवश्यक',
    className: 'border-amber-400 bg-amber-50 text-amber-900',
  },
};

/** Human wording for a report type such as `complete_blood_count`. */
export const formatReportType = (value: string | null | undefined): string => {
  if (!value) return 'Type not identified';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
};

export const COMPARE_EXCLUSION_REASON: Record<string, string> = {
  present_in_only_one_report: 'appears in only one of the selected reports',
  missing_from_some_reports: 'is missing from at least one selected report',
  incompatible_or_unknown_unit: 'was printed in a different or unreadable unit',
  non_numeric_value: 'does not have a numeric value that can be plotted',
};

export const PROCESSING_ERROR_HELP: Record<string, string> = {
  REPORT_SERVICE_UNAVAILABLE:
    'The report reading service was not reachable. Please wait a moment and upload the report again.',
  REPORT_SERVICE_TIMEOUT:
    'Reading the report took too long. A clearer photo or a smaller PDF usually works.',
  REPORT_SERVICE_REJECTED:
    'The file could not be read as a medical report. Check that it is a complete PDF or a clear photo of the printed page.',
  REPORT_SERVICE_INVALID_RESPONSE:
    'The report service returned an unreadable result. Please try uploading again.',
  PROCESSING_FAILED:
    'The report could not be processed. Please try again with a clear copy of the printed report.',
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const shortId = (id: string): string =>
  id.length > 8 ? `${id.slice(0, 8)}…` : id;
