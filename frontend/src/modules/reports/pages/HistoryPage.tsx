import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchReportTypes, fetchReports } from '../api';
import type {
  ReportListFilters,
  ReportProcessingStatus,
  ReportRole,
  ReportSort,
  ReportSummaryDto,
  ReportTypeOption,
  SortOrder,
} from '../types';
import { formatReportType } from '../labels';
import Button from '../../../components/ui/Button';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorBlock from '../../../components/ui/ErrorBlock';
import ReportListItem from '../components/ReportListItem';
import { useRemoteData } from '../useRemoteData';

interface Props {
  role: ReportRole;
  basePath: string;
}

const PAGE_SIZE = 20;
const MAX_COMPARE = 5;

const STATUS_OPTIONS: { value: '' | ReportProcessingStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'COMPLETED', label: 'Ready' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'UPLOADED', label: 'Queued' },
  { value: 'FAILED', label: 'Could not be processed' },
];

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
        <div className="h-4 w-24 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export default function HistoryPage({ role, basePath }: Props) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | ReportProcessingStatus>('');
  const [reportType, setReportType] = useState('');
  const [needsReview, setNeedsReview] = useState(searchParams.get('needsReview') === 'true');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<ReportSort>('uploaded');
  const [order, setOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);

  const [types, setTypes] = useState<ReportTypeOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const filters: ReportListFilters = {
      page,
      pageSize: PAGE_SIZE,
      sort,
      order,
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(reportType ? { reportType } : {}),
      ...(needsReview ? { needsReview: true } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    };
    return fetchReports(filters);
  }, [page, sort, order, q, status, reportType, needsReview, from, to]);

  const filterKey = [page, sort, order, q, status, reportType, String(needsReview), from, to].join("|");
  const { loading, data, error, reload } = useRemoteData(
    `history:${filterKey}`,
    load,
    'Could not load the report history. Please try again.',
  );

  const items: ReportSummaryDto[] = data?.items ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, pageSize: PAGE_SIZE, pages: 1 };

  // Complete, server-derived filter options (never a sample of one page).
  useEffect(() => {
    let active = true;
    fetchReportTypes()
      .then((options) => {
        if (active) setTypes(options);
      })
      .catch(() => {
        // Filter options are optional; the list itself reports its own errors.
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleSelected = (reportId: string) => {
    setSelected((current) => {
      if (current.includes(reportId)) return current.filter((id) => id !== reportId);
      if (current.length >= MAX_COMPARE) return current;
      return [...current, reportId];
    });
  };

  const resetFilters = () => {
    setSearch('');
    setQ('');
    setStatus('');
    setReportType('');
    setNeedsReview(false);
    setFrom('');
    setTo('');
    setSort('uploaded');
    setOrder('desc');
    setPage(1);
    setSelected([]);
    if (searchParams.has('needsReview')) setSearchParams({}, { replace: true });
  };

  const activeFilterCount = [q, status, reportType, needsReview, from, to].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Report history</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Search by report name, type or test, then filter by date and status.
          </p>
        </div>
        {pagination.total > 0 && (
          <p className="text-xs text-slate-500" aria-live="polite">
            {pagination.total} report{pagination.total === 1 ? '' : 's'}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label htmlFor="history-search" className="mb-1 block text-xs font-medium text-slate-600">
              Search
            </label>
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                id="history-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Report name, type or test…"
                className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="history-status" className="mb-1 block text-xs font-medium text-slate-600">
              Status
            </label>
            <select
              id="history-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | ReportProcessingStatus);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="history-type" className="mb-1 block text-xs font-medium text-slate-600">
              Report type
            </label>
            <select
              id="history-type"
              value={reportType}
              onChange={(event) => {
                setReportType(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All types</option>
              {types.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatReportType(option.value)} ({option.reportCount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="history-from" className="mb-1 block text-xs font-medium text-slate-600">
              Report date from
            </label>
            <input
              id="history-from"
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label htmlFor="history-to" className="mb-1 block text-xs font-medium text-slate-600">
              Report date to
            </label>
            <input
              id="history-to"
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label htmlFor="history-sort" className="mb-1 block text-xs font-medium text-slate-600">
              Sort by
            </label>
            <select
              id="history-sort"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as ReportSort);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="uploaded">Date uploaded</option>
              <option value="date">Date printed on report</option>
            </select>
          </div>

          <div>
            <label htmlFor="history-order" className="mb-1 block text-xs font-medium text-slate-600">
              Order
            </label>
            <select
              id="history-order"
              value={order}
              onChange={(event) => {
                setOrder(event.target.value as SortOrder);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(event) => {
                setNeedsReview(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Only reports with results to verify
          </label>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-medium text-blue-700 underline rounded hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {role === 'HOSPITAL_STAFF' && (
        <p className="text-xs text-slate-500">
          This list shows only reports that were explicitly shared with your account. Open a report
          to read it; corrections and deletion are not available to hospital staff.
        </p>
      )}

      {selected.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {selected.length} report{selected.length === 1 ? '' : 's'} selected for comparison
            {selected.length < 2 ? ' — choose at least two.' : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button
              disabled={selected.length < 2}
              onClick={() => navigate(`${basePath}/compare?ids=${selected.join(',')}`)}
            >
              Compare selected
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading && (
          <div className="divide-y divide-slate-100" aria-busy="true">
            <span className="sr-only">Loading reports…</span>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        )}

        {!loading && error && (
          <div className="p-5">
            <ErrorBlock message={error} onRetry={reload} />
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="p-5">
            <EmptyState
              title={activeFilterCount > 0 ? 'No reports match these filters' : 'No reports yet'}
              description={
                activeFilterCount > 0
                  ? 'Try a different search, a wider date range, or clear the filters.'
                  : role === 'HOSPITAL_STAFF'
                    ? 'Reports shared with your account will appear here.'
                    : 'Upload a report to see it here.'
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Clear filters
                  </Button>
                ) : role === 'PATIENT' || role === 'HELPER' ? (
                  <Link
                    to={`${basePath}/upload`}
                    className="text-sm font-medium text-blue-700 hover:underline"
                  >
                    Upload a report
                  </Link>
                ) : undefined
              }
            />
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {items.map((report) => (
              <ReportListItem
                key={report.id}
                report={report}
                basePath={basePath}
                patientName={role === 'PATIENT' ? undefined : (report.patientName ?? undefined)}
                selectable={role !== 'ADMIN' && report.status === 'COMPLETED'}
                selected={selected.includes(report.id)}
                onToggle={toggleSelected}
              />
            ))}
          </ul>
        )}
      </div>

      {!loading && !error && pagination.pages > 1 && (
        <nav aria-label="Report history pagination" className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={pagination.page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((current) => Math.min(pagination.pages, current + 1))}
              disabled={pagination.page >= pagination.pages}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
