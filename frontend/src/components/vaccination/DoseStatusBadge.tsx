import type { ChildDashboardDose } from '../../types/vaccination';

type EffectiveStatus = ChildDashboardDose['status'];

const STYLES: Record<EffectiveStatus, string> = {
  ADMINISTERED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  DUE: 'border-amber-200 bg-amber-50 text-amber-800',
  OVERDUE: 'border-red-200 bg-red-50 text-red-700',
  UPCOMING: 'border-slate-200 bg-slate-50 text-slate-600',
  POSTPONED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  NOT_GIVEN: 'border-slate-300 bg-slate-100 text-slate-700',
};

const LABELS: Record<EffectiveStatus, string> = {
  ADMINISTERED: 'Given',
  DUE: 'Due today',
  OVERDUE: 'Overdue',
  UPCOMING: 'Upcoming',
  POSTPONED: 'Postponed',
  NOT_GIVEN: 'Not given',
};

export default function DoseStatusBadge({ status }: { status: EffectiveStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}