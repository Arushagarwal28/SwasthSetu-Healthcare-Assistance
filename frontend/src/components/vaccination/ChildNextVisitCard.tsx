import Card from '../ui/Card';
import type { ChildDashboard } from '../../types/vaccination';

interface ChildNextVisitCardProps {
  nextVisit: ChildDashboard['nextVisit'];
}

export default function ChildNextVisitCard({ nextVisit }: ChildNextVisitCardProps) {
  return (
    <Card title="Next visit" description="Doses that can be given at the same session.">
      {!nextVisit ? (
        <p className="text-sm text-slate-500">No further doses are scheduled for this child.</p>
      ) : (
        <div>
          <p className="text-lg font-semibold text-slate-900">{nextVisit.date}</p>
          <ul className="mt-2 space-y-1">
            {nextVisit.doses.map((dose) => (
              <li key={dose.id} className="text-sm text-slate-700">
                · {dose.vaccineName} — {dose.doseLabel}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}