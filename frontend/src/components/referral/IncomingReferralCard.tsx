import type { IncomingReferral } from '../../types/referral';
import { calculateAge } from '../../utils/age';
import { formatDateTime } from '../../utils/date';
import Button from '../ui/Button';
import UrgencyBadge from '../triage/UrgencyBadge';
import ReferralStatusBadge from './ReferralStatusBadge';
import type { ActionMode } from './ReferralActionModal';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

interface Props {
  referral: IncomingReferral;
  onAction: (mode: ActionMode) => void;
}

export default function IncomingReferralCard({ referral, onAction }: Props) {
  const { patient, assessment } = referral;
  const confidence =
    assessment.predictionConfidence != null
      ? `${(assessment.predictionConfidence * 100).toFixed(1)}% model confidence`
      : null;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{patient.fullName}</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {calculateAge(patient.dateOfBirth)} yrs · {cap(patient.gender)}
            {patient.phone ? ` · ${patient.phone}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {referral.urgency && <UrgencyBadge urgency={referral.urgency} />}
          <ReferralStatusBadge status={referral.status} />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-500">Model screening result (not a confirmed diagnosis)</p>
        <p className="font-medium text-slate-900 mt-0.5">
          {assessment.predictedDisease ?? 'Not available'}
        </p>
        {confidence && <p className="text-xs text-slate-500 mt-0.5">{confidence}</p>}
      </div>

      {assessment.symptoms.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Reported symptoms</p>
          <ul className="flex flex-wrap gap-2">
            {assessment.symptoms.map((s) => (
              <li
                key={s.symptom.name}
                className="text-xs text-slate-700 bg-white border border-slate-200 rounded-full px-2.5 py-1"
              >
                {s.symptom.name}
                {s.severity ? ` · ${cap(s.severity)}` : ''}
                {s.durationDays != null ? ` · ${s.durationDays}d` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Referred from</dt>
          <dd className="text-slate-800">{referral.sourceFacility?.name ?? 'Self-service (no source facility)'}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Received</dt>
          <dd className="text-slate-800">{formatDateTime(referral.createdAt)}</dd>
        </div>
        {referral.scheduledAt && (
          <div>
            <dt className="text-xs text-slate-500">Scheduled for</dt>
            <dd className="text-slate-800">{formatDateTime(referral.scheduledAt)}</dd>
          </div>
        )}
      </dl>

      {referral.notes && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-slate-500">Note from the referrer</p>
          <p className="text-slate-800 mt-0.5">{referral.notes}</p>
        </div>
      )}
      {referral.hospitalNote && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-slate-500">Your last note</p>
          <p className="text-slate-800 mt-0.5">{referral.hospitalNote}</p>
        </div>
      )}

      {referral.status === 'PENDING' && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="!py-2 !px-4" onClick={() => onAction('accept')}>Accept</Button>
          <Button variant="secondary" className="!py-2 !px-4" onClick={() => onAction('reschedule')}>
            Reschedule
          </Button>
          <Button variant="danger" className="!py-2 !px-4" onClick={() => onAction('reject')}>
            Reject
          </Button>
        </div>
      )}
      {(referral.status === 'ACCEPTED' || referral.status === 'RESCHEDULED') && (
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className="!py-2 !px-4" onClick={() => onAction('complete')}>Mark completed</Button>
          <Button variant="secondary" className="!py-2 !px-4" onClick={() => onAction('reschedule')}>
            Reschedule
          </Button>
        </div>
      )}
    </article>
  );
}
