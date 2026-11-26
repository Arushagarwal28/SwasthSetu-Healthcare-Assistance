import { useCallback, useState } from 'react';
import { fetchAdminStats } from '../api';
import { PROCESSING_LABEL, formatReportType } from '../labels';
import { formatDateTime } from '../../../utils/date';
import Card from '../../../components/ui/Card';
import ErrorBlock from '../../../components/ui/ErrorBlock';
import Spinner from '../../../components/ui/Spinner';
import { useRemoteData } from '../useRemoteData';

const WINDOWS = [7, 30, 90, 365];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

export default function AdminStatsPage() {
  const [days, setDays] = useState(90);

  const load = useCallback(() => fetchAdminStats(days), [days]);
  const { loading, data: stats, error, reload } = useRemoteData(
    `stats:${days}`,
    load,
    'Could not load the programme figures.',
  );

  if (loading) return <Spinner label="Loading programme figures…" />;
  if (error || !stats) {
    return <ErrorBlock message={error || 'No figures available.'} onRetry={reload} />;
  }

  const monthly = stats.reports.monthly.slice(-12);
  const monthlyMax = Math.max(1, ...monthly.map((row) => row.count));
  const statusRows = Object.entries(stats.reports.byStatus);
  const typeRows = Object.entries(stats.reports.byReportType);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Programme figures</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Counts and averages only. Individual reports, patients and test results are never shown
            to administrators.
          </p>
        </div>

        <div>
          <label htmlFor="stats-window" className="mb-1 block text-xs font-medium text-slate-600">
            Period
          </label>
          <select
            id="stats-window"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {WINDOWS.map((value) => (
              <option key={value} value={value}>
                Last {value} days
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={`Reports uploaded (${stats.windowDays} days)`}
          value={String(stats.reports.inWindow)}
          note={`${stats.reports.total} in total`}
        />
        <Stat
          label="Results read"
          value={String(stats.usage.totalTests)}
          note={`${stats.usage.averageTestsPerReport} per report on average`}
        />
        <Stat
          label="Needing verification"
          value={percent(stats.usage.needsReviewShare)}
          note={`${stats.usage.needsReviewTests} of ${stats.usage.totalTests} results`}
        />
        <Stat
          label="Average processing time"
          value={
            stats.usage.averageProcessingMs === null
              ? '—'
              : `${(stats.usage.averageProcessingMs / 1000).toFixed(1)} s`
          }
          note="Reading, explanation and storage"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Reports by month" description="Uploads in each of the last months with activity.">
          {monthly.length === 0 ? (
            <p className="text-sm text-slate-600">No reports in this period.</p>
          ) : (
            <div className="space-y-2">
              {monthly.map((row) => (
                <div key={row.month} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-slate-500">{row.month}</span>
                  <div className="h-3 flex-1 rounded bg-slate-100">
                    <div
                      className="h-3 rounded bg-blue-600"
                      style={{ width: `${Math.max(2, (row.count / monthlyMax) * 100)}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-700">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="By processing status" description="Across every report, not only this period.">
          {statusRows.length === 0 ? (
            <p className="text-sm text-slate-600">No reports recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {statusRows.map(([status, count]) => (
                <li key={status} className="flex justify-between py-2">
                  <span className="text-slate-700">
                    {PROCESSING_LABEL[status as keyof typeof PROCESSING_LABEL] ?? status}
                  </span>
                  <span className="font-medium text-slate-900">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="By report type"
          description={`Small groups (fewer than ${stats.privacy.minimumBucket}) are hidden to protect privacy.`}
        >
          {typeRows.length === 0 ? (
            <p className="text-sm text-slate-600">No reports recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {typeRows.map(([type, count]) => {
                const suppressed = stats.privacy.suppressedBuckets[type] === 'suppressed';
                return (
                  <li key={type} className="flex justify-between py-2">
                    <span className="text-slate-700">{formatReportType(type)}</span>
                    <span className="font-medium text-slate-900">{suppressed ? 'Hidden' : count}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Distinct patients in this period:{' '}
            {stats.privacy.distinctPatientsInWindow === null
              ? 'hidden (fewer than the minimum group size)'
              : stats.privacy.distinctPatientsInWindow}
          </p>
        </Card>

        <Card title="Activity in this period" description="Usage of the module, as counts only.">
          <ul className="divide-y divide-slate-100 text-sm">
            <li className="flex justify-between py-2">
              <span className="text-slate-700">Manual corrections</span>
              <span className="font-medium text-slate-900">{stats.activity.correctionsInWindow}</span>
            </li>
            <li className="flex justify-between py-2">
              <span className="text-slate-700">Reports shared</span>
              <span className="font-medium text-slate-900">{stats.activity.sharesInWindow}</span>
            </li>
            {Object.entries(stats.activity.auditEvents).map(([action, count]) => (
              <li key={action} className="flex justify-between py-2">
                <span className="text-slate-700">Audit: {action.toLowerCase().replace(/_/g, ' ')}</span>
                <span className="font-medium text-slate-900">{count}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Figures generated {formatDateTime(stats.generatedAt)}.
          </p>
        </Card>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        {stats.notice}
      </div>
    </div>
  );
}
