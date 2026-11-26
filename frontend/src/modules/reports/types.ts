/**
 * API types for the Medical Report Simplifier.
 *
 * These mirror the JSON produced by src/modules/reports/report.mapper.ts.
 * Statuses, counts and explanations all come from the backend/Python service;
 * nothing medical is calculated in the browser.
 */

export type ReportRole = 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN';

export type ReportProcessingStatus = 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type TestStatus =
  | 'WITHIN_RANGE'
  | 'HIGH'
  | 'LOW'
  | 'ABNORMAL'
  | 'UNKNOWN'
  | 'NEEDS_REVIEW';

export type CorrectionField = 'value' | 'unit' | 'reference_range' | 'name';

export type ExplanationLanguage = 'en' | 'hi';

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ReportSummaryDto {
  id: string;
  patientId: string;
  /** Only present for reports the signed-in user is allowed to read. */
  patientName: string | null;
  title: string | null;
  reportDate: string | null;
  reportType: string | null;
  reportTypes: string[];
  mixed: boolean;
  status: ReportProcessingStatus;
  errorCode: string | null;
  testCount: number;
  needsReviewCount: number;
  uploadedAt: string;
  processedAt: string | null;
}

export interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface ReportListResponse {
  items: ReportSummaryDto[];
  pagination: Pagination;
}

export type ReportSort = 'date' | 'uploaded';
export type SortOrder = 'asc' | 'desc';

export interface ReportListFilters {
  q?: string;
  status?: ReportProcessingStatus;
  reportType?: string;
  patientId?: string;
  from?: string;
  to?: string;
  needsReview?: boolean;
  sort?: ReportSort;
  order?: SortOrder;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/** The explanation payload for one result, as produced by the Python service. */
export interface TestExplanation {
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
  references: string[];
}

export interface SummaryExplanation {
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

export interface ReportTestDto {
  id: string;
  index: number;
  canonicalId: string | null;
  name: string;
  nameRaw: string;
  category: string;
  value: {
    raw: string | null;
    numeric: number | null;
    qualitative: string | null;
    unit: string | null;
    unitNormalized: string | null;
  };
  extracted: {
    value: string | null;
    unit: string | null;
    referenceText: string | null;
  };
  reference: {
    kind: string;
    low: number | null;
    high: number | null;
    text: string | null;
  };
  status: TestStatus;
  statusLabels: { en: string; hi: string } | null;
  statusReason: string;
  needsReview: boolean;
  reviewReasons: string[];
  corrected: boolean;
  correctedAt: string | null;
  correctedById: string | null;
  verification: { checked: boolean; agreement: string | null };
  explanations: {
    en: TestExplanation | null;
    hi: TestExplanation | null;
  };
}

export interface ReportCorrectionDto {
  id: string;
  testId: string | null;
  field: 'VALUE' | 'UNIT' | 'REFERENCE_RANGE' | 'NAME';
  original: unknown;
  corrected: unknown;
  note: string | null;
  resultingStatus: TestStatus | null;
  createdAt: string;
}

export interface ReportShareDto {
  userId: string;
  /** Staff sign-in email, so the owner can recognise who has access. */
  email: string | null;
  createdAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
}

export interface ReportDetailDto {
  id: string;
  patientId: string;
  patientName: string | null;
  title: string | null;
  originalFilename: string | null;
  fileType: string;
  sizeBytes: number;
  language: ExplanationLanguage;
  status: ReportProcessingStatus;
  errorCode: string | null;
  reportDate: string | null;
  reportType: string | null;
  reportTypes: string[];
  mixed: boolean;
  pageCount: number;
  testCount: number;
  needsReviewCount: number;
  uploadedAt: string;
  processedAt: string | null;
  uploadedByRole: ReportRole;
  tests: ReportTestDto[];
  summary: {
    en: SummaryExplanation | null;
    hi: SummaryExplanation | null;
  };
  corrections: ReportCorrectionDto[];
  shares: ReportShareDto[];
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface UploadReportInput {
  file: File;
  patientId: string;
  title?: string;
  reportDate?: string;
  language?: ExplanationLanguage;
}

export interface StaffFacilityDto {
  id: string;
  name: string;
  type: string;
}

/** One hospital staff account returned by the staff picker. */
export interface StaffTargetDto {
  userId: string;
  email: string;
  facilities: StaffFacilityDto[];
}

export interface StaffTargetResponse {
  items: StaffTargetDto[];
  pagination: Pagination;
}

/** One filter option for the report-type select. */
export interface ReportTypeOption {
  value: string;
  reportCount: number;
}

export interface CorrectionRequestItem {
  testId: string;
  field: CorrectionField;
  corrected: string | number;
  note?: string;
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface ComparePoint {
  reportId: string;
  reportDate: string;
  value: number | null;
  unit: string | null;
  status: TestStatus;
}

export interface ComparisonRow {
  test: string;
  canonicalId: string;
  unit: string | null;
  category: string | null;
  comparable: boolean;
  direction: 'up' | 'down' | 'stable' | null;
  change: number | null;
  daysBetween: number;
  points: ComparePoint[];
}

export interface ExcludedComparison {
  test: string;
  reason: string;
}

export interface CompareResult {
  patientId: string;
  reports: { id: string; reportDate: string; reportType: string | null }[];
  orderedBy: string;
  comparisons: ComparisonRow[];
  excluded: ExcludedComparison[];
  note: string;
}

// ---------------------------------------------------------------------------
// Administrator aggregates (never patient-level)
// ---------------------------------------------------------------------------

export interface AdminReportStats {
  generatedAt: string;
  windowDays: number;
  reports: {
    total: number;
    inWindow: number;
    byStatus: Record<string, number>;
    byReportType: Record<string, number>;
    monthly: { month: string; count: number }[];
  };
  usage: {
    totalTests: number;
    needsReviewTests: number;
    needsReviewShare: number;
    averageProcessingMs: number | null;
    averageTestsPerReport: number;
  };
  privacy: {
    distinctPatientsInWindow: number | null;
    minimumBucket: number;
    suppressedBuckets: Record<string, string>;
  };
  activity: {
    correctionsInWindow: number;
    sharesInWindow: number;
    auditEvents: Record<string, number>;
  };
  notice: string;
}
