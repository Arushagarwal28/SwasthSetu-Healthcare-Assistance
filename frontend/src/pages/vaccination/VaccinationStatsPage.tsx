import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Card from '../../components/ui/Card';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/errors';
import {
  getMyVaccinationStats,
  type VaccinationScopeStats,
} from '../../api/vaccination';

const BASE_PATH_RE = /(\/[^/]+\/vaccination)(?=\/|$)/;

const formatDay = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const count = (n: number): string => n.toLocaleString('en-IN');

interface Metric {
  label: string;
  value: number;
  hint: string;
  to?: string;
  tone: 'plain' | 'danger' | 'warn' | 'ok';
}

const TONE: Record<Metric['tone'], string> = {
  plain: 'text-slate-900',
  danger: 'text-rose-600',
  warn: 'text-amber-600',
  ok: 'text-emerald-600',
};

export default function VaccinationStatsPage() {
  const { pathname } = useLocation();
  const basePath = BASE_PATH_RE.exec(pathname)?.[1] ?? '/helper/vaccination';

  const [stats, setStats] = useState<VaccinationScopeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await getMyVaccinationStats());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your vaccination statistics.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) return <Spinner label="Loading your figures…" />;
  if (error && !stats) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!stats) return null;

  const metrics: Metric[] = [
    {
      label: 'Children in your care',
      value: stats.children,
      hint: 'Registered children you can access',
      to: `${basePath}/children`,
      tone: 'plain',
    },
    {
      label: 'Overdue doses',
      value: stats.overdueDoses,
      hint: 'Due date has passed, still open',
      to: `${basePath}/worklist?status=OVERDUE`,
      tone: stats.overdueDoses > 0 ? 'danger' : 'plain',
    },
    {
      label: 'Children with an overdue dose',
      value: stats.childrenWithOverdue,
      hint: 'At least one dose past its due date',
      to: `${basePath}/worklist?status=OVERDUE`,
      tone: stats.childrenWithOverdue > 0 ? 'danger' : 'plain',
    },
    {
      label: 'Due today',
      value: stats.dueToday,
      hint: 'Doses to give today',
      to: `${basePath}/worklist?status=DUE`,
      tone: stats.dueToday > 0 ? 'warn' : 'plain',
    },
    {
      label: 'Due in the next 7 days',
      value: stats.dueNext7Days,
      hint: 'Plan the coming week',
      to: `${basePath}/worklist?status=UPCOMING&days=7`,
      tone: 'plain',
    },
    {
      label: 'Given in the last 30 days',
      value: stats.administeredLast30Days,
      hint: 'Doses recorded as administered',
      to: `${basePath}/worklist`,
      tone: 'ok',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Your numbers</h2>
          <p className="text-sm text-slate-500">
            Counts for the children you can access, as of {formatDay(stats.asOf)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error} Showing the last figures that loaded.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const body = (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {m.label}
              </p>
              <p className={`mt-2 text-3xl font-semibold ${TONE[m.tone]}`}>{count(m.value)}</p>
              <p className="mt-1 text-xs text-slate-500">{m.hint}</p>
            </>
          );

          return m.to ? (
            <Link
              key={m.label}
              to={m.to}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/30"
            >
              {body}
            </Link>
          ) : (
            <div key={m.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              {body}
            </div>
          );
        })}
      </div>

      {stats.facilityActivity.length > 0 && (
        <Card
          title="Activity at your facilities"
          description="Doses administered and encounters recorded there in the last 30 days."
        >
          <ul className="space-y-2 text-sm">
            {stats.facilityActivity.map((facility) => (
              <li
                key={facility.facilityId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <span className="font-medium text-slate-800">{facility.name}</span>
                <span className="text-xs text-slate-600">
                  {count(facility.dosesAdministeredLast30Days)} doses administered ·{' '}
                  {count(facility.encountersLast30Days)} encounters recorded
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="What needs attention" description="Work through these in order.">
        <ul className="space-y-2 text-sm">
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-700">
              {stats.overdueDoses === 0
                ? 'No overdue doses right now.'
                : `${count(stats.overdueDoses)} overdue dose${stats.overdueDoses === 1 ? '' : 's'} to follow up.`}
            </span>
            <Link to={`${basePath}/worklist?status=OVERDUE`} className="font-medium text-blue-700 hover:underline">
              Open overdue worklist
            </Link>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-700">
              {stats.dueToday === 0
                ? 'Nothing falls due today.'
                : `${count(stats.dueToday)} dose${stats.dueToday === 1 ? '' : 's'} due today.`}
            </span>
            <Link to={`${basePath}/worklist?status=DUE`} className="font-medium text-blue-700 hover:underline">
              Open today&apos;s list
            </Link>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-700">
              {stats.dueNext7Days === 0
                ? 'Nothing due in the next week.'
                : `${count(stats.dueNext7Days)} dose${stats.dueNext7Days === 1 ? '' : 's'} due in the next 7 days.`}
            </span>
            <Link
              to={`${basePath}/worklist?status=UPCOMING&days=7`}
              className="font-medium text-blue-700 hover:underline"
            >
              Plan the week
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}