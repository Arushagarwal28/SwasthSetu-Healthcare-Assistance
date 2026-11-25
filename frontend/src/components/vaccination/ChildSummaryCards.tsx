import Card from '../ui/Card';
import type { ChildDashboard } from '../../types/vaccination';

interface ChildSummaryCardsProps {
  summary: ChildDashboard['summary'];
}

export default function ChildSummaryCards({ summary }: ChildSummaryCardsProps) {
  const tiles = [
    { label: 'Doses given', value: `${summary.administered} / ${summary.total}`, tone: 'text-emerald-700' },
    { label: 'Overdue', value: summary.overdue, tone: 'text-red-700' },
    { label: 'Due today', value: summary.dueToday, tone: 'text-amber-700' },
    { label: 'Upcoming', value: summary.upcoming, tone: 'text-slate-700' },
    { label: 'Not given', value: summary.notGiven, tone: 'text-slate-700' },
  ];

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">Schedule progress</h2>
        <span className="text-sm font-semibold text-emerald-700">{summary.completionPercent}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${summary.completionPercent}%` }}
        />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-slate-200 px-3 py-2">
            <dt className="text-xs text-slate-500">{tile.label}</dt>
            <dd className={`mt-0.5 text-lg font-semibold ${tile.tone}`}>{tile.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}