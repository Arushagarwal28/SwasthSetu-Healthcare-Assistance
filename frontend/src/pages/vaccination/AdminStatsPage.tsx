import { useCallback, useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import ErrorBlock from '../../components/ui/ErrorBlock';
import Spinner from '../../components/ui/Spinner';
import { getApiErrorMessage } from '../../utils/errors';
import {
  getVaccinationAdminStats,
  type VaccinationAdminStats,
} from '../../api/vaccination';

const formatDay = (ymd: string): string => {
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ymd
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const count = (n: number): string => n.toLocaleString('en-IN');

const share = (part: number, total: number): number =>
  total <= 0 ? 0 : Math.round((part / total) * 1000) / 10;

interface BarRow {
  label: string;
  value: number;
  percent: number;
  className: string;
}

function Bars({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-slate-700">{row.label}</span>
            <span className="tabular-nums text-slate-600">
              {count(row.value)}
              <span className="ml-2 text-xs text-slate-400">{row.percent}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${row.className}`}
              style={{ width: `${Math.min(100, Math.max(0, row.percent))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface Kpi {
  label: string;
  value: number;
  hint: string;
  tone?: 'plain' | 'danger' | 'warn' | 'ok';
}

const KPI_TONE: Record<NonNullable<Kpi['tone']>, string> = {
  plain: 'text-slate-900',
  danger: 'text-rose-600',
  warn: 'text-amber-600',
  ok: 'text-emerald-600',
};

export default function AdminStatsPage() {
  const [stats, setStats] = useState<VaccinationAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStats(await getVaccinationAdminStats());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load platform statistics.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) return <Spinner label="Loading programme figures…" />;
  if (error && !stats) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!stats) return null;

  const { children, doses, activity, byVaccine, reminders, centres } = stats;
  const givenShare = share(doses.administered, doses.total);

  const doseRows: BarRow[] = [
    { label: 'Administered', value: doses.administered, percent: share(doses.administered, doses.total), className: 'bg-emerald-500' },
    { label: 'Pending', value: doses.pending, percent: share(doses.pending, doses.total), className: 'bg-blue-500' },
    { label: 'Postponed', value: doses.postponed, percent: share(doses.postponed, doses.total), className: 'bg-amber-500' },
    { label: 'Not given', value: doses.notGiven, percent: share(doses.notGiven, doses.total), className: 'bg-rose-500' },
  ];

  const kpis: Kpi[] = [
    { label: 'Children registered', value: children.total, hint: 'All records in the programme' },
    { label: 'New in the last 30 days', value: children.registeredLast30Days, hint: 'Registrations since 30 days ago' },
    { label: 'Facilities with activity', value: activity.facilitiesWithActivity, hint: 'Facilities that have administered a recorded dose' },
    { label: 'Doses recorded', value: doses.total, hint: 'Every dose row in the programme' },
    { label: 'Doses administered', value: doses.administered, hint: `${givenShare}% of all recorded doses`, tone: 'ok' },
    { label: 'Overdue doses', value: doses.overdue, hint: 'Past due date and still open', tone: doses.overdue > 0 ? 'danger' : 'plain' },
    { label: 'Due today', value: doses.dueToday, hint: 'Open doses dated today', tone: doses.dueToday > 0 ? 'warn' : 'plain' },
    { label: 'Due in the next 7 days', value: doses.dueNext7Days, hint: 'Open doses in the coming week' },
    { label: 'Centres offering vaccines', value: centres.facilitiesOfferingVaccines, hint: 'Active facilities with at least one vaccine' },
  ];

  const bestDistricts = children.byDistrict.slice(0, 20);
  const districtMax = bestDistricts.reduce((n, d) => Math.max(n, d.count), 0);

  const reminderEntries = Object.entries(reminders.last7Days).sort((a, b) => a[0].localeCompare(b[0]));

  const byChannel = reminders.deliveriesLast7Days.reduce<
    Record<string, { status: string; count: number }[]>
  >((acc, row) => {
    const list = acc[row.channel] ?? [];
    list.push({ status: row.status, count: row.count });
    acc[row.channel] = list;
    return acc;
  }, {});
  const channels = Object.keys(byChannel).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Programme figures</h2>
          <p className="text-sm text-slate-500">
            Aggregated counts only, as of {formatDay(stats.asOf)}. No child record is shown to administrators.
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
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
            <p className={`mt-2 text-3xl font-semibold ${KPI_TONE[k.tone ?? 'plain']}`}>
              {count(k.value)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Dose status" description="Share of every recorded dose row.">
          <Bars rows={doseRows} />
        </Card>

        <Card title="Children by district" description="Top 20 districts by registered children.">
          {bestDistricts.length === 0 ? (
            <p className="text-sm text-slate-500">No children registered yet.</p>
          ) : (
            <Bars
              rows={bestDistricts.map((d) => ({
                label: d.district,
                value: d.count,
                percent: share(d.count, districtMax),
                className: 'bg-blue-500',
              }))}
            />
          )}
        </Card>
      </div>

      <Card
        title="Coverage by vaccine"
        description="Coverage counts doses whose due date has arrived; doses not yet due are excluded."
      >
        {byVaccine.length === 0 ? (
          <p className="text-sm text-slate-500">No doses recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">Vaccine</th>
                  <th className="py-2 pr-4 text-right font-medium">Given</th>
                  <th className="py-2 pr-4 text-right font-medium">Not given</th>
                  <th className="py-2 pr-4 text-right font-medium">Overdue</th>
                  <th className="py-2 font-medium">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {byVaccine.map((row) => (
                  <tr key={row.vaccineCode} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-800">{row.vaccineCode}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-700">{count(row.administered)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-slate-600">{count(row.notGiven)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-rose-600">{count(row.overdue)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${Math.min(100, Math.max(0, row.coveragePercent))}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-slate-600">{row.coveragePercent}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Doses by facility"
          description="Top 10 facilities by doses actually administered there. Children belong to no facility."
        >
          {activity.dosesByFacility.length === 0 ? (
            <p className="text-sm text-slate-500">No doses have been attributed to a facility yet.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {activity.dosesByFacility.map((f, index) => (
                <li
                  key={f.facilityId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span className="text-slate-700">
                    <span className="mr-2 tabular-nums text-xs text-slate-400">{index + 1}.</span>
                    {f.name}
                  </span>
                  <span className="tabular-nums font-medium text-slate-900">
                    {count(f.total)}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {count(f.last30Days)} in 30 days
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Reminders, last 7 days" description="Scheduled reminders and delivery attempts.">
          {reminderEntries.length === 0 && channels.length === 0 ? (
            <p className="text-sm text-slate-500">No reminder activity in the last 7 days.</p>
          ) : (
            <div className="space-y-4 text-sm">
              {reminderEntries.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Reminders by status
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {reminderEntries.map(([status, total]) => (
                      <li
                        key={status}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                      >
                        {status}: <span className="font-semibold">{count(total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {channels.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Deliveries by channel
                  </p>
                  <ul className="space-y-1">
                    {channels.map((channel) => (
                      <li key={channel} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
                        <span className="font-medium text-slate-800">{channel}</span>
                        <span className="text-xs text-slate-600">
                          {byChannel[channel]
                            .slice()
                            .sort((a, b) => a.status.localeCompare(b.status))
                            .map((s) => `${s.status} ${count(s.count)}`)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}