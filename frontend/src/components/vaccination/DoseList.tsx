import Card from '../ui/Card';
import DoseStatusBadge from './DoseStatusBadge';
import type { ChildDashboardDose } from '../../types/vaccination';

interface DoseListProps {
  title: string;
  description?: string;
  doses: ChildDashboardDose[];
  emptyText: string;
  onAction?: (dose: ChildDashboardDose) => void;
  /** Verified cross-facility staff cannot correct another facility's given dose. */
  allowCorrections?: boolean;
}

export default function DoseList({
  title,
  description,
  doses,
  emptyText,
  onAction,
  allowCorrections = true,
}: DoseListProps) {
  return (
    <Card title={title} description={description}>
      {doses.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {doses.map((dose) => (
            <li key={dose.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">
                    {dose.vaccineName}
                    <span className="font-normal text-slate-500"> · {dose.doseLabel}</span>
                  </p>
                  <DoseStatusBadge status={dose.status} />
                </div>

                <p className="mt-0.5 text-xs text-slate-500">
                  Due {dose.dueDate}
                  {dose.originalDueDate !== dose.dueDate && ` (was ${dose.originalDueDate})`}
                  {dose.status === 'OVERDUE' && dose.daysOverdue > 0 &&
                    ` · ${dose.daysOverdue} ${dose.daysOverdue === 1 ? 'day' : 'days'} overdue`}
                  {dose.status === 'UPCOMING' && dose.daysUntilDue > 0 &&
                    ` · in ${dose.daysUntilDue} ${dose.daysUntilDue === 1 ? 'day' : 'days'}`}
                </p>

                {dose.administeredOn && (
                  <p className="mt-0.5 text-xs text-emerald-700">
                    Given on {dose.administeredOn}
                    {dose.administeredFacility
                      ? ` at ${dose.administeredFacility.name}`
                      : ' · administering facility not recorded'}
                    {dose.recordedBy ? ` · recorded by ${dose.recordedBy.name}` : ''}
                  </p>
                )}

                {dose.wasLate && (
                  <p className="mt-0.5 text-xs font-medium text-amber-700">
                    Given late: {dose.daysLate} {dose.daysLate === 1 ? 'day' : 'days'} after the due
                    date
                  </p>
                )}

                {dose.notes && <p className="mt-0.5 text-xs text-slate-600">{dose.notes}</p>}
              </div>

              {onAction && (allowCorrections || dose.recordedStatus !== 'ADMINISTERED') && (
                <button
                  type="button"
                  onClick={() => onAction(dose)}
                  className="shrink-0 self-start rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {dose.recordedStatus === 'ADMINISTERED' ? 'Correct record' : 'Update'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}