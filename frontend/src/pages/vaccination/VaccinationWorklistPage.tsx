/**
 * Vaccination worklist — "who needs a vaccine?" for helpers and hospital staff.
 *
 * GET /vaccination/worklist already scopes results to the children the signed-in
 * user may access (a helper's own registrations, or the children a staff member
 * holds a live temporary grant for), so no permission logic lives in the browser. The endpoint also
 * sends the adult-friendly fields (parent mobile, village) and the derived status,
 * so this page only has to group, filter and paginate.
 */
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getWorklist } from '../../api/vaccination';
import { getApiErrorMessage } from '../../utils/errors';
import { primaryButtonLink } from '../../components/ui/buttonLink';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';

/** The four values GET /vaccination/worklist accepts for `status`. */
type WorklistStatusFilter = 'ALL' | 'OVERDUE' | 'DUE' | 'UPCOMING';

/** EffectiveStatus from the backend, minus the ones the worklist never returns. */
type WorklistDoseStatus =
  | 'OVERDUE'
  | 'DUE'
  | 'UPCOMING'
  | 'POSTPONED'
  | 'ADMINISTERED'
  | 'NOT_GIVEN';

interface WorklistItem {
  doseId: string;
  childId: string;
  recordNumber: string;
  childName: string;
  village: string | null;
  district: string | null;
  parentMobile: string | null;
  vaccineName: string;
  doseLabel: string;
  /** YYYY-MM-DD, IST. */
  dueDate: string;
  status: WorklistDoseStatus;
  daysOverdue: number;
  daysUntilDue: number;
}

interface WorklistPayload {
  /** Today in IST, YYYY-MM-DD — the date the counts and statuses were computed for. */
  asOf: string;
  summary: { overdue: number; dueToday: number; upcoming: number; upcomingDays: number };
  total: number;
  page: number;
  limit: number;
  items: WorklistItem[];
}

const PAGE_SIZE = 25;

const TABS: { key: WorklistStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All open' },
  { key: 'OVERDUE', label: 'Overdue' },
  { key: 'DUE', label: 'Due today' },
  { key: 'UPCOMING', label: 'Upcoming' },
];

const DAY_CHOICES = [7, 14, 30];

const STATUS_STYLE: Record<string, string> = {
  OVERDUE: 'bg-red-50 text-red-700 border-red-200',
  DUE: 'bg-amber-50 text-amber-800 border-amber-200',
  UPCOMING: 'bg-slate-50 text-slate-600 border-slate-200',
  POSTPONED: 'bg-violet-50 text-violet-700 border-violet-200',
  ADMINISTERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NOT_GIVEN: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABEL: Record<string, string> = {
  OVERDUE: 'Overdue',
  DUE: 'Due today',
  UPCOMING: 'Upcoming',
  POSTPONED: 'Postponed',
  ADMINISTERED: 'Given',
  NOT_GIVEN: 'Not given',
};

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** 2026-11-23 -> "23 Nov 2026". Anything unexpected is returned unchanged. */
const formatYmd = (ymd: string): string => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!parts) return ymd;
  const month = MONTHS[Number(parts[2]) - 1] ?? '';
  return `${Number(parts[3])} ${month} ${parts[1]}`.replace(/\s+/g, ' ').trim();
};

const plural = (n: number, one: string, many: string): string =>
  n === 1 ? `1 ${one}` : `${n} ${many}`;

const dueHint = (item: WorklistItem): string => {
  if (item.status === 'OVERDUE') return `${plural(item.daysOverdue, 'day', 'days')} overdue`;
  if (item.daysUntilDue === 0) return 'Due today';
  if (item.daysUntilDue === 1) return 'Due tomorrow';
  return `Due in ${item.daysUntilDue} days`;
};

const dueHintClass = (item: WorklistItem): string => {
  if (item.status === 'OVERDUE') return 'text-red-600 font-medium';
  if (item.status === 'DUE' || item.daysUntilDue === 0) return 'text-amber-700 font-medium';
  return 'text-slate-500';
};

const countFor = (key: WorklistStatusFilter, summary: WorklistPayload['summary']): number => {
  if (key === 'OVERDUE') return summary.overdue;
  if (key === 'DUE') return summary.dueToday;
  if (key === 'UPCOMING') return summary.upcoming;
  return summary.overdue + summary.dueToday + summary.upcoming;
};

export default function VaccinationWorklistPage() {
  // /helper/vaccination/worklist -> /helper/vaccination, so links keep the role prefix.
  const basePath = useLocation().pathname.replace(/\/worklist\/?$/, '');

  const [data, setData] = useState<WorklistPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState<WorklistStatusFilter>('ALL');
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  // The backend filters by name so paging stays correct; debounce so we do not
  // fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      setAppliedSearch((current) => {
        if (current !== next) setPage(1);
        return next;
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    getWorklist({
      status,
      days,
      page,
      limit: PAGE_SIZE,
      search: appliedSearch === '' ? undefined : appliedSearch,
    })
      .then((payload) => {
        if (cancelled) return;
        setData(payload as unknown as WorklistPayload);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          getApiErrorMessage(
            err,
            'Could not load the vaccination worklist. Please check your connection and try again.',
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status, days, page, appliedSearch, reloadKey]);

  const changeStatus = (next: WorklistStatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  const changeDays = (next: number) => {
    setDays(next);
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const from = data && data.total > 0 ? (data.page - 1) * data.limit + 1 : 0;
  const to = data ? Math.min(data.page * data.limit, data.total) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vaccination worklist</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Children in your care who are overdue or due soon.
            {data && (
              <>
                {' '}
                As of {formatYmd(data.asOf)}.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setReloadKey((key) => key + 1)}
            loading={loading}
            loadingText="Refreshing…"
          >
            Refresh
          </Button>
          <Link to={`${basePath}/children/new`} className={primaryButtonLink}>
            + Register child
          </Link>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          {TABS.map((tab) => {
            const selected = status === tab.key;
            const count = data ? countFor(tab.key, data.summary) : null;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => changeStatus(tab.key)}
                aria-pressed={selected}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  selected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
                {count !== null && (
                  <span
                    className={`ml-1.5 text-xs ${selected ? 'text-blue-100' : 'text-slate-500'}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="text"
              aria-label="Search the worklist by child name"
              placeholder="Search by child name…"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="whitespace-nowrap">Upcoming within</span>
            <select
              value={days}
              onChange={(e) => changeDays(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {DAY_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice} days
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {loading && !data && <Spinner label="Loading the worklist…" />}

      {error !== '' && (
        <Card>
          <ErrorBlock message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </Card>
      )}

      {!error && data && data.items.length === 0 && (
        <EmptyState
          title={
            appliedSearch === ''
              ? 'Nothing needs attention here'
              : 'No child matches that name'
          }
          description={
            appliedSearch === ''
              ? status === 'UPCOMING'
                ? `No doses are due in the next ${days} days.`
                : 'No open doses match this filter.'
              : 'Try a shorter name, or clear the search to see the whole worklist.'
          }
          action={
            appliedSearch === '' ? (
              <Link to={`${basePath}/children/new`} className={primaryButtonLink}>
                Register a child
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => setSearch('')}>
                Clear search
              </Button>
            )
          }
        />
      )}

      {!error && data && data.items.length > 0 && (
        <>
          <p className="text-xs text-slate-500" aria-live="polite">
            Showing {from}–{to} of {plural(data.total, 'open dose', 'open doses')}
            {loading && ' · refreshing…'}
          </p>

          <ul role="list" className="space-y-3">
            {data.items.map((item) => {
              const place = [item.village, item.district].filter(Boolean).join(', ');
              return (
                <li
                  key={item.doseId}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`${basePath}/children/${item.childId}`}
                          className="font-medium text-slate-900 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
                        >
                          {item.childName}
                        </Link>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                            STATUS_STYLE[item.status] ?? STATUS_STYLE.UPCOMING
                          }`}
                        >
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.recordNumber}
                        {place !== '' && ` · ${place}`}
                      </p>

                      <p className="mt-2 text-sm text-slate-800">
                        {item.vaccineName}
                        <span className="text-slate-400"> · </span>
                        {item.doseLabel}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Due {formatYmd(item.dueDate)}
                        <span className="text-slate-400"> · </span>
                        <span className={dueHintClass(item)}>{dueHint(item)}</span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {item.parentMobile && (
                        <a
                          href={`tel:${item.parentMobile}`}
                          className="rounded-md border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          Call
                        </a>
                      )}
                      <Link to={`${basePath}/children/${item.childId}`} className={primaryButtonLink}>
                        Open record
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                disabled={data.page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <p className="text-xs text-slate-500">
                Page {data.page} of {totalPages}
              </p>
              <Button
                variant="secondary"
                disabled={data.page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}