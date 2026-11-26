/**
 * Mapping between database rows, the Python payload shape and API DTOs.
 *
 * The stored `parsedPayload` is the canonical representation handed back to the
 * Python service. Columns exist for querying and for the UI, and are kept in
 * sync whenever a correction changes a result.
 */
import type {
  ExplanationKind,
  MedicalReport,
  MedicalReportTest,
  Prisma,
  ReportCorrection,
  ReportExplanation,
  ReportShare,
} from '@prisma/client';
import type {
  ExplainedReportPayload,
  ParsedReportPayload,
  ParsedTestPayload,
  TestStatus,
} from './report.types';

export const STATUS_LABELS: Record<TestStatus, { en: string; hi: string }> = {
  WITHIN_RANGE: { en: 'Within the printed range', hi: 'छपी हुई सीमा के भीतर' },
  HIGH: { en: 'Above the printed range', hi: 'छपी हुई सीमा से अधिक' },
  LOW: { en: 'Below the printed range', hi: 'छपी हुई सीमा से कम' },
  ABNORMAL: { en: 'Reported as abnormal', hi: 'असामान्य बताया गया' },
  UNKNOWN: { en: 'Cannot be compared', hi: 'तुलना नहीं की जा सकती' },
  NEEDS_REVIEW: { en: 'Needs manual verification', hi: 'मैन्युअल जाँच आवश्यक' },
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Build the Python payload from the stored columns (used when no blob exists). */
export function payloadFromRows(
  report: MedicalReport,
  tests: MedicalReportTest[],
  corrections: ParsedReportPayload['corrections'] = []
): ParsedReportPayload {
  const mapped: ParsedTestPayload[] = tests
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((test) => ({
      index: test.index,
      canonical_id: test.canonicalId,
      canonical_name: test.canonicalName,
      category: test.category,
      name_raw: test.nameRaw,
      name_normalized: test.nameRaw,
      name_match: {
        method: test.nameMatchMethod ?? 'unknown',
        score: test.nameMatchScore ?? 0,
      },
      extracted: {
        value_raw: test.extractedValueRaw,
        value_numeric: test.extractedValueNumeric,
        unit_raw: test.extractedUnitRaw,
        reference_text: test.extractedReferenceText,
      },
      value_raw: test.valueRaw,
      value_numeric: test.valueNumeric,
      value_qualitative: test.valueQualitative,
      unit_raw: test.unitRaw,
      unit_normalized: test.unitNormalized,
      unit_known: test.unitKnown,
      reference: {
        kind: test.referenceKind as ParsedTestPayload['reference']['kind'],
        low: test.referenceLow,
        high: test.referenceHigh,
        low_inclusive: test.referenceLowInclusive,
        high_inclusive: test.referenceHighInclusive,
        text_raw: test.referenceText,
        qualitative_expected: null,
      },
      lab_flag_raw: test.labFlagRaw,
      status: test.status as TestStatus,
      status_basis: test.statusBasis,
      status_reason: test.statusReason,
      confidence: test.confidence,
      needs_review: test.needsReview,
      review_reasons: test.reviewReasons,
      verification: {
        checked: test.verificationChecked,
        primary_reading: test.verificationPrimary,
        secondary_reading: test.verificationSecondary,
        agreement: test.verificationAgreement ?? 'not_checked',
        languages: [],
      },
      source: {
        page_index: test.pageIndex,
        line_index: test.lineIndex,
        row_index: test.rowIndex,
        page_source: test.pageSource,
        bbox: {},
      },
      corrections: corrections as ParsedTestPayload['corrections'],
    }));

  return {
    success: true,
    document_id: report.id,
    report: {
      primary: report.reportTypePrimary ?? 'other',
      detected: report.reportTypeDetected,
      mixed: report.reportTypeMixed,
      confidence: 0,
    },
    tests: mapped,
    unparsed_lines: [],
    corrections,
    warnings: [],
  };
}

/** Prefer the stored blob; fall back to the columns for older rows. */
export function payloadFromStored(
  report: MedicalReport,
  tests: MedicalReportTest[]
): ParsedReportPayload {
  const stored = report.parsedPayload;
  const record = asRecord(stored);
  if (Array.isArray(record.tests) && record.tests.length > 0) {
    return stored as unknown as ParsedReportPayload;
  }
  return payloadFromRows(report, tests);
}

/** Columns persisted for one parsed result. */
export function testColumns(
  reportId: string,
  test: ParsedTestPayload
): Prisma.MedicalReportTestCreateManyInput {
  return {
    reportId,
    index: test.index,
    canonicalId: test.canonical_id ?? null,
    canonicalName: test.canonical_name,
    category: test.category,
    nameRaw: test.name_raw,
    nameMatchMethod: test.name_match?.method ?? null,
    nameMatchScore: asNumber(test.name_match?.score),
    extractedValueRaw: test.extracted?.value_raw ?? null,
    extractedValueNumeric: asNumber(test.extracted?.value_numeric),
    extractedUnitRaw: test.extracted?.unit_raw ?? null,
    extractedReferenceText: test.extracted?.reference_text ?? null,
    valueRaw: test.value_raw ?? null,
    valueNumeric: asNumber(test.value_numeric),
    valueQualitative: test.value_qualitative ?? null,
    unitRaw: test.unit_raw ?? null,
    unitNormalized: test.unit_normalized ?? null,
    unitKnown: Boolean(test.unit_known),
    referenceKind: test.reference?.kind ?? 'unknown',
    referenceLow: asNumber(test.reference?.low),
    referenceHigh: asNumber(test.reference?.high),
    referenceLowInclusive: test.reference?.low_inclusive ?? true,
    referenceHighInclusive: test.reference?.high_inclusive ?? true,
    referenceText: test.reference?.text_raw ?? null,
    labFlagRaw: test.lab_flag_raw ?? null,
    status: test.status,
    statusBasis: test.status_basis,
    statusReason: test.status_reason,
    confidence: asNumber(test.confidence) ?? 0,
    needsReview: Boolean(test.needs_review),
    reviewReasons: asStringArray(test.review_reasons),
    verificationChecked: Boolean(test.verification?.checked),
    verificationPrimary: test.verification?.primary_reading ?? null,
    verificationSecondary: test.verification?.secondary_reading ?? null,
    verificationAgreement: test.verification?.agreement ?? null,
    pageIndex: test.source?.page_index ?? 0,
    lineIndex: test.source?.line_index ?? 0,
    rowIndex: test.source?.row_index ?? 0,
    pageSource: test.source?.page_source ?? 'pdf_text',
  };
}

/** Explanation rows for the explanations returned by the Python service. */
export function explanationRows(
  reportId: string,
  explanations: Record<'en' | 'hi', ExplainedReportPayload>,
  testIdsByIndex: Map<number, string>
): Prisma.ReportExplanationCreateManyInput[] {
  const rows: Prisma.ReportExplanationCreateManyInput[] = [];
  const languages: ('en' | 'hi')[] = ['en', 'hi'];

  for (const language of languages) {
    const explained = explanations[language];
    if (!explained) continue;

    rows.push({
      reportId,
      testId: null,
      kind: 'REPORT_SUMMARY' as ExplanationKind,
      language,
      scopeKey: 'summary',
      provider: explained.provider || 'rule-based',
      text: [explained.summary.title, '', explained.summary.overview, '', ...explained.summary.key_points]
        .filter(Boolean)
        .join('\n'),
      payload: explained.summary as unknown as Prisma.InputJsonValue,
    });

    for (const test of explained.tests) {
      const testId = testIdsByIndex.get(test.index);
      if (!testId) continue;
      rows.push({
        reportId,
        testId,
        kind: 'TEST' as ExplanationKind,
        language,
        scopeKey: `test:${test.index}`,
        provider: explained.provider || 'rule-based',
        text: [test.result_line, test.status_text, test.interpretation_note ?? '']
          .filter(Boolean)
          .join('\n'),
        payload: test as unknown as Prisma.InputJsonValue,
      });
    }
  }

  return rows;
}

type DetailReport = MedicalReport & {
  tests: MedicalReportTest[];
  explanations: ReportExplanation[];
  shares: (ReportShare & { user?: { email: string } | null })[];
  corrections: ReportCorrection[];
  patient: { id: string; fullName: string; userId: string | null };
};

export interface DetailDtoOptions {
  /**
   * Hospital staff can read a shared report but never manage sharing, so the
   * list of other recipients (and their emails) is withheld from them.
   */
  redactShares?: boolean;
}

function explanationFor(
  explanations: ReportExplanation[],
  language: 'en' | 'hi',
  scopeKey: string
): Record<string, unknown> | null {
  const row = explanations.find((item) => item.language === language && item.scopeKey === scopeKey);
  return row ? asRecord(row.payload) : null;
}

/**
 * Compact representation used by the history list.
 *
 * `patientName` is filled from the row's own patient relation, which the query
 * only loads for reports the caller is already allowed to see (`toSummaryDto`
 * cannot widen visibility).
 */
export function toSummaryDto(
  report: MedicalReport & { patient?: { fullName: string } | null }
) {
  return {
    id: report.id,
    patientId: report.patientId,
    patientName: report.patient?.fullName ?? null,
    title: report.title,
    reportDate: report.reportDate,
    reportType: report.reportTypePrimary,
    reportTypes: report.reportTypeDetected,
    mixed: report.reportTypeMixed,
    status: report.status,
    errorCode: report.errorCode,
    testCount: report.testCount,
    needsReviewCount: report.needsReviewCount,
    uploadedAt: report.createdAt,
    processedAt: report.processedAt,
  };
}

/** Full report with results, both languages and correction history. */
export function toDetailDto(report: DetailReport, options: DetailDtoOptions = {}) {
  const tests = report.tests
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((test) => ({
      id: test.id,
      index: test.index,
      canonicalId: test.canonicalId,
      name: test.canonicalName,
      nameRaw: test.nameRaw,
      category: test.category,
      value: {
        raw: test.valueRaw,
        numeric: test.valueNumeric,
        qualitative: test.valueQualitative,
        unit: test.unitRaw,
        unitNormalized: test.unitNormalized,
      },
      extracted: {
        value: test.extractedValueRaw,
        unit: test.extractedUnitRaw,
        referenceText: test.extractedReferenceText,
      },
      reference: {
        kind: test.referenceKind,
        low: test.referenceLow,
        high: test.referenceHigh,
        text: test.referenceText,
      },
      status: test.status,
      statusLabels: STATUS_LABELS[test.status as TestStatus] ?? null,
      statusReason: test.statusReason,
      needsReview: test.needsReview,
      reviewReasons: test.reviewReasons,
      corrected: test.correctedAt !== null,
      correctedAt: test.correctedAt,
      correctedById: test.correctedById,
      verification: {
        checked: test.verificationChecked,
        agreement: test.verificationAgreement,
      },
      explanations: {
        en: explanationFor(report.explanations, 'en', `test:${test.index}`),
        hi: explanationFor(report.explanations, 'hi', `test:${test.index}`),
      },
    }));

  return {
    id: report.id,
    patientId: report.patientId,
    patientName: report.patient.fullName,
    title: report.title,
    originalFilename: report.originalFilename,
    fileType: report.fileMimeType,
    sizeBytes: report.fileSizeBytes,
    language: report.language,
    status: report.status,
    errorCode: report.errorCode,
    reportDate: report.reportDate,
    reportType: report.reportTypePrimary,
    reportTypes: report.reportTypeDetected,
    mixed: report.reportTypeMixed,
    pageCount: report.pageCount,
    testCount: report.testCount,
    needsReviewCount: report.needsReviewCount,
    uploadedAt: report.createdAt,
    processedAt: report.processedAt,
    uploadedByRole: report.uploadedByRole,
    tests,
    summary: {
      en: explanationFor(report.explanations, 'en', 'summary'),
      hi: explanationFor(report.explanations, 'hi', 'summary'),
    },
    corrections: report.corrections.map((item) => ({
      id: item.id,
      testId: item.testId,
      field: item.field,
      original: item.originalValue,
      corrected: item.correctedValue,
      note: item.note,
      resultingStatus: item.resultingStatus,
      createdAt: item.createdAt,
    })),
    shares: options.redactShares
      ? []
      : report.shares.map((share) => ({
          userId: share.userId,
          email: share.user?.email ?? null,
          createdAt: share.createdAt,
          revokedAt: share.revokedAt,
          expiresAt: share.expiresAt,
        })),
  };
}

export const documentPayloadFor = (payload: ParsedReportPayload): ParsedReportPayload => ({
  ...payload,
  tests: payload.tests.slice(),
});
