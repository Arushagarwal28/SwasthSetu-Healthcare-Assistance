import { useState } from 'react';
import Button from '../ui/Button';
import { getApiErrorMessage } from '../../utils/errors';

interface Props {
  facilityName: string;
  onConfirm: (note: string) => Promise<void>;
  onClose: () => void;
}

export default function ConfirmReferralModal({ facilityName, onConfirm, onClose }: Props) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(note.trim());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the referral. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-referral-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-lg p-6">
        <h2 id="confirm-referral-title" className="text-lg font-semibold text-slate-900">
          Send referral
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          This patient will be referred to <span className="font-medium">{facilityName}</span>.
        </p>

        <label htmlFor="referral-note" className="block text-sm font-medium text-slate-700 mt-4 mb-1.5">
          Note for the hospital <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="referral-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />

        {error && (
          <div role="alert" className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 mt-5">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} loading={submitting} loadingText="Sending…">
            Send referral
          </Button>
        </div>
      </div>
    </div>
  );
}
