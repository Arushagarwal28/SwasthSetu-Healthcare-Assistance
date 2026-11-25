import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchChildren } from '../../api/vaccination';
import type { ChildSummary } from '../../types/vaccination';
import { getApiErrorMessage } from '../../utils/errors';
import { calculateAge } from '../../utils/age';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorBlock from '../../components/ui/ErrorBlock';
import { primaryButtonLink } from '../../components/ui/buttonLink';

/** Rows per screen after the client-side search is applied. */
const PAGE_SIZE = 20;
/** The list endpoint's maximum page size. */
const FETCH_PAGE_SIZE = 100;
/** Safety cap: at most 1000 children are pulled for client-side search. */
const MAX_PAGES = 10;

interface Props {
  /** Vaccination module root, e.g. `/helper/vaccination` or `/hospital/vaccination`. */
  basePath: string;
}

const initials = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

const formatGender = (gender: string) => gender.charAt(0) + gender.slice(1).toLowerCase();

const formatDate = (ymd: string): string =>
  new Date(`${ymd}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * The API has no search parameter, so the whole accessible set is loaded first
 * (100 rows per request, capped) and search + pagination happen in the browser.
 */
const loadAllChildren = async () => {
  const first = await fetchChildren(1, FETCH_PAGE_SIZE);
  const items = [...first.items];

  const lastPage = Math.min(Math.ceil(first.total / FETCH_PAGE_SIZE), MAX_PAGES);
  for (let page = 2; page <= lastPage; page += 1) {
    const next = await fetchChildren(page, FETCH_PAGE_SIZE);
    items.push(...next.items);
  }

  return { items, total: first.total, truncated: first.total > items.length };
};

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-4 animate-pulse">
      <div className="h-11 w-11 shrink-0 rounded-full bg-slate-200" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 rounded bg-slate-200" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
      <div className="hidden sm:block h-3 w-24 rounded bg-slate-100" />
    </div>
  );
}

export default function ChildrenListPage({ basePath }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const createdRecordNumber = searchParams.get('created');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadAllChildren();
      setChildren(data.items);
      setTotal(data.total);
      setTruncated(data.truncated);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load the children list. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return children;
    return children.filter(
      (child) =>
        child.fullName.toLowerCase().includes(term) ||
        child.recordNumber.toLowerCase().includes(term) ||
        child.village.toLowerCase().includes(term) ||
        child.district.toLowerCase().includes(term)
    );
  }, [children, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold text-slate-900">Children</h1>
            {!loading && !error && children.length > 0 && (
              <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-0.5">
                {total}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Children whose vaccination records you can see. Open a child to review their doses.
          </p>
        </div>
        <Link to={`${basePath}/children/new`} className={primaryButtonLink}>
          + Register Child
        </Link>
      </div>

      {createdRecordNumber && (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5"
        >
          <span>Child {createdRecordNumber} was registered and the dose schedule was created.</span>
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className="self-start sm:self-auto text-emerald-900 underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Dismiss
          </button>
        </div>
      )}

      {children.length > 0 && (
        <>
          <div className="relative">
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
              type="search"
              aria-label="Search children by name, record number, village or district"
              placeholder="Search by name, record number, village or district…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <p className="text-xs text-slate-500" aria-live="polite">
            Showing {filtered.length} of {children.length} loaded
          </p>
        </>
      )}

      {truncated && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3.5 py-2.5">
          Search covers the first {children.length} of {total} children. Newer records load first.
        </p>
      )}

      {loading && (
        <div
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100"
          aria-busy="true"
        >
          <span className="sr-only">Loading children…</span>
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ErrorBlock message={error} onRetry={load} />
        </div>
      )}

      {!loading && !error && children.length === 0 && (
        <EmptyState
          title="No children registered yet"
          description="Register a child to create their vaccination schedule and start tracking doses."
          action={
            <Link to={`${basePath}/children/new`} className={primaryButtonLink}>
              + Register Child
            </Link>
          }
        />
      )}

      {!loading && !error && children.length > 0 && filtered.length === 0 && (
        <EmptyState
          title="No children match your search"
          description="Try a different name, record number, village or district."
        />
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <ul className="divide-y divide-slate-100">
            {visible.map((child) => (
              <li key={child.id}>
                <Link
                  to={`${basePath}/children/${child.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
                    {initials(child.fullName)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{child.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {child.recordNumber} · {calculateAge(child.dateOfBirth)} yrs ·{' '}
                      {formatGender(child.gender)}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="text-sm text-slate-700">
                      {child.village}, {child.district}
                    </p>
                    <p className="text-xs text-slate-500">Born {formatDate(child.dateOfBirth)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:w-44 sm:justify-end">
                    {child.overdueCount > 0 && (
                      <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                        {child.overdueCount} overdue
                      </span>
                    )}
                    {child.dueTodayCount > 0 && (
                      <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                        {child.dueTodayCount} due today
                      </span>
                    )}
                    {child.overdueCount === 0 && child.dueTodayCount === 0 && (
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                        No doses due
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && filtered.length > PAGE_SIZE && (
        <nav aria-label="Children pagination" className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Page {currentPage} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === pageCount}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}