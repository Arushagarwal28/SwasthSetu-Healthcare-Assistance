import { Link } from 'react-router-dom';
import type { ReportSummaryDto } from '../types';
import { PROCESSING_LABEL, formatReportDate, formatReportType } from '../labels';

interface Props {
  report: ReportSummaryDto;
  basePath: string;
  /** Shown for helpers, whose list spans several patients. */
  patientName?: string;
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (reportId: string) => void;
}

const STATUS_STYLE: Record<ReportSummaryDto['status'], string> = {
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  PROCESSING: 'border-blue-200 bg-blue-50 text-blue-800',
  UPLOADED: 'border-slate-200 bg-slate-50 text-slate-700',
  FAILED: 'border-red-200 bg-red-50 text-red-800',
};

export default function ReportListItem({
  report,
  basePath,
  patientName,
  selectable = false,
  selected = false,
  onToggle,
}: Props) {
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle?.(report.id)}
          aria-label={`Select ${report.title || formatReportType(report.reportType)} for comparison`}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
      )}

      <div className="min-w-0 flex-1">
        <Link
          to={`${basePath}/${report.id}`}
          className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <p className="font-medium text-slate-900 break-words">
            {report.title || `${formatReportType(report.reportType)} report`}
          </p>
        </Link>

        <p className="mt-0.5 text-xs text-slate-500">
          {formatReportType(report.reportType)}
          {' · '}
          {report.reportDate
            ? `Report dated ${formatReportDate(report.reportDate)}`
            : 'Report date not printed'}
          {patientName ? ` · ${patientName}` : ''}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[report.status]}`}
          >
            {report.status === 'FAILED' && <span aria-hidden="true">✕</span>}
            {report.status === 'COMPLETED' && <span aria-hidden="true">✓</span>}
            {PROCESSING_LABEL[report.status]}
          </span>

          {report.status === 'COMPLETED' && (
            <span className="text-[11px] text-slate-600">
              {report.testCount} result{report.testCount === 1 ? '' : 's'}
            </span>
          )}

          {report.needsReviewCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
              <span aria-hidden="true">⚠</span>
              {report.needsReviewCount} to verify
            </span>
          )}
        </div>
      </div>

      <span className="hidden shrink-0 text-xs text-slate-500 sm:block">
        Uploaded {formatReportDate(report.uploadedAt)}
      </span>
    </li>
  );
}
