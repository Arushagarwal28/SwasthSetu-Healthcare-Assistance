import Card from '../ui/Card';
import { formatDateTime } from '../../utils/date';
import type { ChildDashboard, ChildDashboardDose } from '../../types/vaccination';

interface ChildActivityListProps {
  entries: ChildDashboard['recentActivity'];
}

const STATUS_TEXT: Record<ChildDashboardDose['recordedStatus'], string> = {
  PENDING: 'Pending',
  ADMINISTERED: 'Given',
  POSTPONED: 'Postponed',
  NOT_GIVEN: 'Not given',
};

const statusText = (status: ChildDashboardDose['recordedStatus'] | null): string =>
  status ? STATUS_TEXT[status] : 'New dose';

export default function ChildActivityList({ entries }: ChildActivityListProps) {
  return (
    <Card title="Recent activity" description="The last ten changes to this child's doses.">
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">No changes recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="border-l-2 border-slate-200 pl-3">
              <p className="text-sm font-medium text-slate-900">
                {entry.vaccineName}
                <span className="font-normal text-slate-500"> · {entry.doseLabel}</span>
              </p>
              <p className="text-xs text-slate-600">
                {statusText(entry.fromStatus)} → {statusText(entry.toStatus)}
                {entry.toDueDate && entry.fromDueDate !== entry.toDueDate && ` · due ${entry.toDueDate}`}
              </p>
              <p className="text-xs text-slate-500">
                {entry.facility
                  ? `Recorded at ${entry.facility.name}`
                  : 'Facility of this encounter not recorded'}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateTime(entry.at)}
                {entry.changedBy ? ` · ${entry.changedBy.name}` : ''}
              </p>
              {entry.note && <p className="mt-1 text-xs text-slate-600">{entry.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}