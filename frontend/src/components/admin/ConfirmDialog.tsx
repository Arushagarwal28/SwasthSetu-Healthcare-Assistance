import { useState } from 'react';
import Button from '../ui/Button';
import { getApiErrorMessage } from '../../utils/errors';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function ConfirmDialog({ title, message, confirmLabel, danger = false, onConfirm, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</p>

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
            variant={danger ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={submitting}
            loadingText="Working…"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
