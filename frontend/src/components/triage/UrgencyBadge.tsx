interface Props {
  urgency: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

const STYLES: Record<Props['urgency'], string> = {
  LOW: 'bg-slate-50 text-slate-600 border-slate-200',
  MODERATE: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

export default function UrgencyBadge({ urgency }: Props) {
  return (
    <span className={`inline-block text-xs font-medium rounded-full px-2.5 py-0.5 border ${STYLES[urgency]}`}>
      {urgency.charAt(0) + urgency.slice(1).toLowerCase()} urgency
    </span>
  );
}