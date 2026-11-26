/**
 * Shared types for the Medical Report Simplifier module.
 *
 * The parsed report shape mirrors the Python service's `ParsedReport.to_dict()`
 * exactly. It is stored verbatim so corrections and explanations can run on the
 * result long after the uploaded document has been deleted.
 */

export type ReportRole = 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN';

export type TestStatus =
  | 'WITHIN_RANGE'
  | 'HIGH'
  | 'LOW'
  | 'ABNORMAL'
  | 'UNKNOWN'
  | 'NEEDS_REVIEW';

export const TEST_STATUSES: readonly TestStatus[] = [
  'WITHIN_RANGE',
  'HIGH',
  'LOW',
  'ABNORMAL',
  'UNKNOWN',
  'NEEDS_REVIEW',
];

export type CorrectionField = 'value' | 'unit' | 'reference_range' | 'name';

export const CORRECTION_FIELDS: readonly CorrectionField[] = [
  'value',
  'unit',
  'reference_range',
  'name',
];

export type ExplanationLanguage = 'en' | 'hi';

export interface ParsedRangePayload {
  kind: 'interval' | 'upper' | 'lower' | 'qualitative' | 'unknown';
  low: number | null;
  high: number | null;
  low_inclusive: boolean;
  high_inclusive: boolean;
  text_raw: string | null;
  qualitative_expected: string | null;
}

export interface ParsedSourcePayload {
  page_index: number;
  line_index: number;
  row_index: number;
  page_source: string;
  bbox: Record<string, number>;
}

export interface ParsedVerificationPayload {
  checked: boolean;
  primary_reading: string | null;
  secondary_reading: string | null;
  agreement: string;
  languages: string[];
}

export interface ParsedCorrectionPayload {
  field: string;
  original: unknown;
  corrected: unknown;
  corrected_by: string;
  corrected_at: string;
  note: string | null;
}

export interface ParsedTestPayload {
  index: number;
  canonical_id: string | null;
  canonical_name: string;
  category: string;
  name_raw: string;
  name_normalized: string;
  name_match: { method: string; score: number };
  extracted: {
    value_raw: string | null;
    value_numeric: number | null;
    unit_raw: string | null;
    reference_text: string | null;
  };
  value_raw: string | null;
  value_numeric: number | null;
  value_qualitative: string | null;
  unit_raw: string | null;
  unit_normalized: string | null;
  unit_known: boolean;
  reference: ParsedRangePayload;
  lab_flag_raw: string | null;
  status: TestStatus;
  status_basis: string;
  status_reason: string;
  confidence: number;
  needs_review: boolean;
  review_reasons: string[];
  verification: ParsedVerificationPayload;
  source: ParsedSourcePayload;
  corrections: ParsedCorrectionPayload[];
}

export interface ParsedReportMetaPayload {
  primary: string;
  detected: string[];
  mixed: boolean;
  confidence: number;
  evidence?: unknown[];
}

/** The exact JSON the Python service produces and consumes. */
export interface ParsedReportPayload {
  success?: boolean;
  document_id?: string | null;
  report: ParsedReportMetaPayload;
  tests: ParsedTestPayload[];
  unparsed_lines: { text?: string }[];
  corrections: ParsedCorrectionPayload[];
  warnings: string[];
  stats?: Record<string, unknown>;
}

export interface TestExplanationPayload {
  index: number;
  canonical_id: string | null;
  name: string;
  category: string;
  status: TestStatus;
  status_label: string;
  known_test: boolean;
  measures: string | null;
  result_line: string;
  status_text: string;
  interpretation_note: string | null;
  correction_note: string | null;
  caution: string | null;
  review_reasons: string[];
  values_used: Record<string, unknown>;
  references: string[];
}

export interface SummaryExplanationPayload {
  language: ExplanationLanguage;
  title: string;
  overview: string;
  counts: Record<string, number>;
  total_tests: number;
  report_kind: string;
  categories: string[];
  key_points: string[];
  next_steps: string[];
  disclaimers: string[];
}

export interface ExplainedReportPayload {
  language: ExplanationLanguage;
  provider: string;
  document_id: string | null;
  summary: SummaryExplanationPayload;
  tests: TestExplanationPayload[];
  warnings: string[];
}

export interface CorrectionRequestItem {
  testId: string;
  field: CorrectionField;
  corrected: string | number;
  note?: string;
}
