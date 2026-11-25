import type { ReferralStatus } from '../../types/referral';

const STYLES: Record<ReferralStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  RESCHEDULED: 'bg-blue-50 text-blue-700 border-blue-200',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-500 border-slate-200',
};

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RESCHEDULED: 'Rescheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function ReferralStatusBadge({ status }: { status: ReferralStatus }) {
  return (
    <span
      className={`inline-block text-xs font-medium rounded-full px-2.5 py-0.5 border ${STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
