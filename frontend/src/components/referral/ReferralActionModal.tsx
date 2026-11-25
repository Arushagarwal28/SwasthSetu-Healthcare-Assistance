import { useState } from 'react';
import Button from '../ui/Button';
import { getApiErrorMessage } from '../../utils/errors';
import { toLocalInputValue } from '../../utils/date';

export type ActionMode = 'accept' | 'reject' | 'reschedule' | 'complete';

interface Props {
  mode: ActionMode;
  patientName: string;
  onSubmit: (values: { scheduledAt?: string; note: string }) => Promise<void>;
  onClose: () => void;
}

const CONFIG: Record<
  ActionMode,
  {
    title: string;
    submit: string;
    loading: string;
    dateLabel?: string;
    dateRequired?: boolean;
    noteLabel: string;
    noteRequired?: boolean;
    danger?: boolean;
  }
> = {
  accept: {
    title: 'Accept referral',
    submit: 'Accept',
    loading: 'Accepting…',
    dateLabel: 'Appointment time (optional)',
    noteLabel: 'Note for the patient (optional)',
  },
  reschedule: {
    title: 'Propose a new time',
    submit: 'Reschedule',
    loading: 'Saving…',
    dateLabel: 'New appointment time',
    dateRequired: true,
    noteLabel: 'Note for the patient (optional)',
  },
  reject: {
    title: 'Reject referral',
    submit: 'Reject',
    loading: 'Rejecting…',
    noteLabel: 'Reason for rejection',
    noteRequired: true,
    danger: true,
  },
  complete: {
    title: 'Mark as completed',
    submit: 'Mark completed',
    loading: 'Saving…',
    noteLabel: 'Note (optional)',
  },
};

export default function ReferralActionModal({ mode, patientName, onSubmit, onClose }: Props) {
  const cfg = CONFIG[mode];
  const [scheduledAt, setScheduledAt] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (cfg.dateRequired && !scheduledAt) {
      setError('Please choose a date and time.');
      return;
    }
    if (scheduledAt && new Date(scheduledAt) <= new Date()) {
      setError('The date and time must be in the future.');
      return;
    }
    if (cfg.noteRequired && !note.trim()) {
      setError('Please give a reason.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        note: note.trim(),
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="referral-action-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
        <h2 id="referral-action-title" className="text-lg font-semibold text-slate-900">
          {cfg.title}
        </h2>
        <p className="text-sm text-slate-500 mt-1">Patient: {patientName}</p>

        {cfg.dateLabel && (
          <div className="mt-4">
            <label htmlFor="action-date" className="block text-sm font-medium text-slate-700 mb-1.5">
              {cfg.dateLabel}
            </label>
            <input
              id="action-date"
              type="datetime-local"
              value={scheduledAt}
              min={toLocalInputValue(new Date())}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="action-note" className="block text-sm font-medium text-slate-700 mb-1.5">
            {cfg.noteLabel}
          </label>
          <textarea
            id="action-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {error && (
          <div role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={cfg.danger ? 'danger' : 'primary'}
            onClick={handleSubmit}
            loading={submitting}
            loadingText={cfg.loading}
          >
            {cfg.submit}
          </Button>
        </div>
      </div>
    </div>
  );
}
