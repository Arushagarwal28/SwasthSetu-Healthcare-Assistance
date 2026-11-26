import { useCallback, useEffect, useState } from 'react';
import { useRemoteData } from '../useRemoteData';
import { Link, useNavigate } from 'react-router-dom';
import {
  applyCorrections,
  deleteReport,
  downloadReportPdf,
  fetchReport,
  revokeShare,
  shareReport,
} from '../api';
import type {
  CorrectionRequestItem,
  ExplanationLanguage,
  ReportDetailDto,
  ReportRole,
  ReportTestDto,
  TestExplanation,
} from '../types';
import {
  PROCESSING_ERROR_HELP,
  TEST_STATUS_STYLE,
  formatBytes,
  formatReportDate,
  formatReportType,
  shortId,
} from '../labels';
import { getApiErrorMessage } from '../../../utils/errors';
import { formatDateTime } from '../../../utils/date';
import Spinner from '../../../components/ui/Spinner';
import ErrorBlock from '../../../components/ui/ErrorBlock';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import ConfirmDialog from '../../../components/admin/ConfirmDialog';
import { secondaryButtonLink } from '../../../components/ui/buttonLink';
import ResultStatusBadge from '../components/ResultStatusBadge';
import ReferenceRangeBar from '../components/ReferenceRangeBar';
import SummaryBlock, { LanguageToggle } from '../components/SummaryBlock';
import CorrectionDialog from '../components/CorrectionDialog';
import ShareDialog from '../components/ShareDialog';

interface Props {
  role: ReportRole;
  basePath: string;
  reportId: string;
}

const FIELD_LABEL: Record<string, string> = {
  VALUE: 'Result value',
  UNIT: 'Unit',
  REFERENCE_RANGE: 'Reference range',
  NAME: 'Test name',
};

const valueText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
};

const rangeCaption = (status: ReportTestDto['status']): string => {
  switch (status) {
    case 'HIGH':
      return 'above the printed range';
    case 'LOW':
      return 'below the printed range';
    case 'WITHIN_RANGE':
      return 'inside the printed range';
    default:
      return 'shown against the printed range for reference';
  }
};

function TestCard({
  test,
  language,
  canManage,
  onCorrect,
}: {
  test: ReportTestDto;
  language: ExplanationLanguage;
  canManage: boolean;
  onCorrect: (test: ReportTestDto) => void;
}) {
  const explanation: TestExplanation | null = test.explanations[language] ?? test.explanations.en;
  const statusLabel = explanation?.status_label ?? TEST_STATUS_STYLE[test.status]?.[language];

  const numericValue = test.value.numeric;
  const unit = test.value.unit ?? test.value.unitNormalized;

  return (
    <article
      className={`rounded-xl border bg-white p-4 ${
        test.needsReview ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-medium text-slate-900 break-words">{explanation?.name || test.name}</h3>
          {test.nameRaw && test.nameRaw.trim() && test.nameRaw.trim() !== test.name && (
            <p className="mt-0.5 text-xs text-slate-500">Printed as “{test.nameRaw}”</p>
          )}
          {explanation?.measures && (
            <p className="mt-1 text-xs text-slate-600">{explanation.measures}</p>
          )}
        </div>
        <ResultStatusBadge
          status={test.status}
          label={statusLabel}
          language={language}
        />
      </div>

      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Result</dt>
          <dd className="font-medium text-slate-900">
            {test.value.raw ?? valueText(numericValue)}
            {unit ? ` ${unit}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Range printed on the report</dt>
          <dd className="text-slate-900">{test.reference.text ?? 'Not printed'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Category</dt>
          <dd className="text-slate-900">{test.category || 'Not identified'}</dd>
        </div>
      </dl>

      {test.corrected && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <p className="font-medium">Manually verified and corrected</p>
          <p className="mt-0.5">
            Originally extracted: {test.extracted.value ?? '—'}
            {test.extracted.unit ? ` ${test.extracted.unit}` : ''}
            {test.correctedAt ? ` · corrected ${formatDateTime(test.correctedAt)}` : ''}
          </p>
          <p className="mt-0.5 text-blue-800">
            The extracted value is kept for reference and is never overwritten.
          </p>
        </div>
      )}

      {test.needsReview && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium" lang={language}>
            <span aria-hidden="true">⚠ </span>
            {language === 'hi'
              ? 'यह पुष्ट परिणाम नहीं है। कृपया छपी हुई रिपोर्ट से इसकी जाँच करें।'
              : 'Not a verified finding. Check this value against the printed report.'}
          </p>
          {test.reviewReasons.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {test.reviewReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ReferenceRangeBar
        value={numericValue}
        low={test.reference.low}
        high={test.reference.high}
        unit={unit}
        caption={rangeCaption(test.status)}
      />

      {explanation && (
        <div lang={language} className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          <p className="text-sm font-medium text-slate-800">{explanation.result_line}</p>
          <p className="text-sm text-slate-700">{explanation.status_text}</p>
          {explanation.interpretation_note && (
            <p className="text-sm text-slate-600">{explanation.interpretation_note}</p>
          )}
          {explanation.correction_note && (
            <p className="text-xs text-blue-800">{explanation.correction_note}</p>
          )}
          {explanation.caution && (
            <p className="text-xs text-amber-800">{explanation.caution}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">
          {test.statusReason || 'Status is based on the range printed on the report.'}
        </p>
        {canManage && (
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 !text-xs sm:shrink-0"
            onClick={() => onCorrect(test)}
          >
            Verify or correct
          </Button>
        )}
      </div>
    </article>
  );
}

export default function ReportDetailPage({ role, basePath, reportId }: Props) {
  const navigate = useNavigate();
  const canManage = role === 'PATIENT' || role === 'HELPER';

  const load = useCallback(() => fetchReport(reportId), [reportId]);
  const {
    loading,
    data: report,
    error,
    loadedAt,
    reload,
    mutate,
  } = useRemoteData<ReportDetailDto>(`report:${reportId}`, load, 'This report could not be loaded.');

  // The reader's choice wins; until they pick a language the report's own
  // language is used, without an effect that would rewrite state on load.
  const [languageChoice, setLanguageChoice] = useState<ExplanationLanguage | null>(null);
  const language: ExplanationLanguage =
    languageChoice ?? (report?.language === 'hi' ? 'hi' : 'en');

  const [correcting, setCorrecting] = useState<ReportTestDto | null>(null);
  const [sharing, setSharing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  // A report that is still being read refreshes itself until it settles.
  useEffect(() => {
    if (!report || (report.status !== 'PROCESSING' && report.status !== 'UPLOADED')) return;
    const timer = window.setTimeout(reload, 4000);
    return () => window.clearTimeout(timer);
  }, [report, reload]);

  const handleCorrection = async (items: CorrectionRequestItem[]) => {
    const updated = await applyCorrections(reportId, items);
    mutate(() => updated);
    setCorrecting(null);
    setNotice('The correction was saved and the explanations were recalculated.');
  };

  const handleShare = async (userId: string, expiresAt?: string) => {
    await shareReport(reportId, userId, expiresAt);
    setSharing(false);
    setNotice('The report was shared. Access can be revoked at any time.');
    reload();
  };

  const handleRevoke = async (userId: string) => {
    setActionError('');
    try {
      await revokeShare(reportId, userId);
      setNotice('Access was revoked.');
      reload();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Access could not be revoked. Please try again.'));
    }
  };

  const handlePdf = async () => {
    setActionError('');
    setPdfBusy(true);
    try {
      await downloadReportPdf(reportId);
    } catch (err) {
      setActionError(
        getApiErrorMessage(
          err,
          'The PDF could not be prepared. PDF export may be unavailable on this server.',
        ),
      );
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8">
        <Spinner label="Loading the report…" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Link to={`${basePath}/history`} className="text-sm font-medium text-blue-700 hover:underline">
          ← Back to reports
        </Link>
        <Card>
          <ErrorBlock message={error || 'This report could not be found.'} onRetry={reload} />
        </Card>
      </div>
    );
  }

  const activeShares = report.shares.filter(
    (item) =>
      !item.revokedAt &&
      (!item.expiresAt || new Date(item.expiresAt).getTime() > loadedAt),
  );
  const pastShares = report.shares.filter((item) => !activeShares.includes(item));

  const title = report.title || `${formatReportType(report.reportType)} report`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`${basePath}/history`}
          className="text-sm font-medium text-blue-700 rounded hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          ← Back to reports
        </Link>
      </div>

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-900 break-words">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatReportType(report.reportType)}
            {' · '}
            {report.reportDate
              ? `Report dated ${formatReportDate(report.reportDate)}`
              : 'Report date not printed'}
            {report.pageCount > 1 ? ` · ${report.pageCount} pages` : ''}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Uploaded {formatDateTime(report.uploadedAt)} by{' '}
            {report.uploadedByRole === 'HELPER' ? 'a helper' : 'the patient'}
            {role !== 'PATIENT' && report.patientName ? ` · patient: ${report.patientName}` : ''}
            {report.originalFilename ? ` · ${report.originalFilename}` : ''}
            {report.sizeBytes ? ` · ${formatBytes(report.sizeBytes)}` : ''}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            The original file is not kept; only these extracted results and explanations are stored.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {report.status === 'COMPLETED' && (
            <Button variant="secondary" onClick={handlePdf} loading={pdfBusy} loadingText="Preparing…">
              Download PDF
            </Button>
          )}
          {canManage && (
            <Button variant="secondary" onClick={() => setSharing(true)}>
              Share
            </Button>
          )}
          {canManage && (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800"
        >
          {actionError}
        </div>
      )}

      {report.status === 'FAILED' && (
        <div className="rounded-xl border border-red-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">This report could not be read</h3>
          <p className="mt-1 text-sm text-slate-600">
            {PROCESSING_ERROR_HELP[report.errorCode ?? ''] ??
              PROCESSING_ERROR_HELP.PROCESSING_FAILED}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            The uploaded file is no longer available, so the report has to be uploaded again.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`${basePath}/upload`} className={secondaryButtonLink}>
              Upload the report again
            </Link>
            <Button variant="ghost" onClick={reload}>
              Check again
            </Button>
          </div>
        </div>
      )}

      {(report.status === 'PROCESSING' || report.status === 'UPLOADED') && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h3 className="text-base font-semibold text-blue-950">Still reading this report</h3>
          <p className="mt-1 text-sm text-blue-900">
            The pages are being read and the explanation is being written. This page updates on its
            own; you can also refresh it.
          </p>
          <Button variant="secondary" className="mt-3" onClick={reload}>
            Refresh
          </Button>
        </div>
      )}

      {report.status === 'COMPLETED' && (
        <>
          {report.needsReviewCount > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">
                <span aria-hidden="true">⚠ </span>
                {report.needsReviewCount} of {report.testCount} results need manual verification
              </p>
              <p className="mt-1">
                These values could not be read confidently. They are shown with the printed text
                where available and are not confirmed findings. Compare each one with the paper
                report, then use “Verify or correct”.
              </p>
            </div>
          )}

          <Card
            title="What this report says"
            action={<LanguageToggle value={language} onChange={setLanguageChoice} />}
          >
            <SummaryBlock summary={report.summary[language]} language={language} />
            {report.summary[language] === null && report.summary.en === null && (
              <p className="mt-3 text-sm text-slate-600">
                A plain-language summary is not available for this report. The extracted results are
                listed below.
              </p>
            )}
          </Card>

          <section aria-labelledby="results-heading" className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <h3 id="results-heading" className="text-lg font-semibold text-slate-900">
                Results ({report.testCount})
              </h3>
              <p className="text-xs text-slate-500">
                Values and ranges are exactly as printed on the report.
              </p>
            </div>

            {report.tests.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                No individual results could be read from this report. Compare the upload with the
                printed report; a clearer photo or a text-based PDF usually reads better.
              </div>
            )}

            <div className="space-y-3">
              {report.tests.map((test) => (
                <TestCard
                  key={test.id}
                  test={test}
                  language={language}
                  canManage={canManage}
                  onCorrect={setCorrecting}
                />
              ))}
            </div>
          </section>

          {report.corrections.length > 0 && (
            <Card title="Correction history" description="Every manual change is kept alongside the original reading.">
              <ul className="divide-y divide-slate-100">
                {report.corrections
                  .slice()
                  .reverse()
                  .map((correction) => {
                    const test = report.tests.find((item) => item.id === correction.testId);
                    return (
                      <li key={correction.id} className="py-3 text-sm">
                        <p className="font-medium text-slate-900">
                          {test?.name ?? 'Result'} · {FIELD_LABEL[correction.field] ?? correction.field}
                        </p>
                        <p className="mt-0.5 text-slate-600">
                          <span className="line-through decoration-slate-400">
                            {valueText(correction.original)}
                          </span>{' '}
                          → <span className="font-medium text-slate-900">{valueText(correction.corrected)}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateTime(correction.createdAt)}
                          {correction.note ? ` · ${correction.note}` : ''}
                          {correction.resultingStatus
                            ? ` · status after correction: ${TEST_STATUS_STYLE[correction.resultingStatus]?.en ?? correction.resultingStatus}`
                            : ''}
                        </p>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}

          {canManage && (
            <Card
              title="Shared access"
              description="Only hospital staff accounts can be given access, and it is read-only."
              action={<Button variant="secondary" onClick={() => setSharing(true)}>Share report</Button>}
            >
              {activeShares.length === 0 && pastShares.length === 0 && (
                <p className="text-sm text-slate-600">This report is not shared with anyone.</p>
              )}

              {activeShares.length > 0 && (
                <ul className="space-y-2">
                  {activeShares.map((share) => (
                    <li
                      key={share.userId}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                                                  <p className="font-medium text-slate-900 break-words">
                          {share.email ?? `Hospital staff · ${shortId(share.userId)}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          Shared {formatDateTime(share.createdAt)}
                          {share.expiresAt
                            ? ` · ends ${formatReportDate(share.expiresAt)}`
                            : ' · no expiry'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        className="!px-3 !py-1.5 !text-xs self-start sm:self-auto"
                        onClick={() => void handleRevoke(share.userId)}
                      >
                        Revoke access
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {pastShares.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Previous access
                  </h4>
                  <ul className="mt-1.5 space-y-1 text-xs text-slate-500">
                    {pastShares.map((share) => (
                      <li key={share.userId}>
                        {share.email ?? `Hospital staff · ${shortId(share.userId)}`} ·{' '}
                        {share.revokedAt ? 'revoked' : 'expired'}{' '}
                        {formatDateTime(share.revokedAt ?? share.expiresAt ?? share.createdAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
            <p className="font-semibold text-slate-800">Medical disclaimer</p>
            <p className="mt-1">
              This page explains the results printed on a medical report. It is not a diagnosis and
              does not replace advice from a qualified doctor. Reference ranges are the ones printed
              on your report; different laboratories may use different ranges. If a result is
              marked for verification, treat it as unconfirmed until it has been checked.
            </p>
            <p className="mt-1" lang="hi">
              यह पृष्ठ रिपोर्ट में छपे परिणामों की समझ देता है। यह कोई निदान नहीं है और डॉक्टर की
              सलाह का विकल्प नहीं है।
            </p>
          </div>
        </>
      )}

      {correcting && (
        <CorrectionDialog
          test={correcting}
          onClose={() => setCorrecting(null)}
          onSubmit={handleCorrection}
        />
      )}

      {sharing && (
        <ShareDialog onClose={() => setSharing(false)} onSubmit={handleShare} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this report?"
          message="The extracted results and their explanations will be removed from SwasthSetu. The original uploaded file is already gone. This cannot be undone."
          confirmLabel="Delete report"
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteReport(reportId);
            navigate(`${basePath}/history`, { replace: true });
          }}
        />
      )}
    </div>
  );
}
