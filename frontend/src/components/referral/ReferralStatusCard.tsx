import type { Referral, ReferralStatus } from '../../types/referral';
import { formatDateTime } from '../../utils/date';
import Card from '../ui/Card';
import Button from '../ui/Button';
import ReferralStatusBadge, { STATUS_LABEL } from './ReferralStatusBadge';

const STATUS_MESSAGE: Record<ReferralStatus, string> = {
  PENDING: 'Waiting for the hospital to review this referral.',
  ACCEPTED: 'The hospital has accepted this referral.',
  REJECTED: 'The hospital could not accept this referral. You can choose another facility below.',
  RESCHEDULED: 'The hospital has proposed a different time.',
  COMPLETED: 'This referral has been completed.',
  CANCELLED: 'This referral was cancelled.',
};

interface Props {
  referral: Referral;
  onCancel?: () => void;
  cancelling?: boolean;
}

export default function ReferralStatusCard({ referral, onCancel, cancelling = false }: Props) {
  const showTime =
    referral.scheduledAt && (referral.status === 'ACCEPTED' || referral.status === 'RESCHEDULED');

  return (
    <Card className="mb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Referral sent to</p>
          <h2 className="font-semibold text-slate-900">{referral.destinationFacility.name}</h2>
          {referral.destinationFacility.address && (
            <p className="text-sm text-slate-500 mt-0.5">{referral.destinationFacility.address}</p>
          )}
        </div>
        <ReferralStatusBadge status={referral.status} />
      </div>

      <p className="text-sm text-slate-700 mt-4">{STATUS_MESSAGE[referral.status]}</p>

      {showTime && (
        <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-3.5 py-2.5 text-sm">
          <span className="text-blue-700">
            {referral.status === 'RESCHEDULED' ? 'Proposed time: ' : 'Appointment: '}
          </span>
          <span className="font-medium text-blue-950">{formatDateTime(referral.scheduledAt!)}</span>
        </div>
      )}

      {referral.hospitalNote && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-slate-500">
            {referral.status === 'REJECTED' ? 'Reason from the hospital' : 'Note from the hospital'}
          </p>
          <p className="text-slate-800 mt-0.5">{referral.hospitalNote}</p>
        </div>
      )}

      {referral.notes && (
        <div className="mt-3 text-sm">
          <p className="text-xs text-slate-500">Your note</p>
          <p className="text-slate-800 mt-0.5">{referral.notes}</p>
        </div>
      )}

      {referral.history.length > 0 && (
        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-2">History</p>
          <ol className="space-y-2">
            {referral.history.map((h) => (
              <li key={h.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                <div>
                  <p className="text-slate-800">
                    {STATUS_LABEL[h.toStatus]}
                    <span className="text-slate-400"> · {formatDateTime(h.createdAt)}</span>
                  </p>
                  {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {referral.status === 'PENDING' && onCancel && (
        <div className="mt-5">
          <Button variant="secondary" onClick={onCancel} loading={cancelling} loadingText="Cancelling…">
            Cancel referral
          </Button>
        </div>
      )}
    </Card>
  );
}
