import { useState } from 'react';
import Button from '../ui/Button';
import { getApiErrorMessage } from '../../utils/errors';
import { recordDose } from '../../api/vaccination';
import type { ChildDashboardDose, DoseAction, RecordDoseInput } from '../../types/vaccination';

interface DoseActionDialogProps {
  childId: string;
  childDateOfBirth: string;
  dose: ChildDashboardDose;
  onClose: () => void;
  onSaved: (dose: ChildDashboardDose) => void;
}

interface ActionOption {
  action: DoseAction;
  label: string;
}

const MAX_POSTPONE_DAYS = 365;
const BATCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\-_/]{1,29}$/;

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
const labelClass = 'mb-1 block text-xs font-medium text-slate-600';

const pad = (n: number) => String(n).padStart(2, '0');

/** Today in the user's local calendar, the same day the server counts in IST. */
const todayYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addDaysYmd = (ymd: string, days: number): string => {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function optionsFor(status: ChildDashboardDose['recordedStatus']): ActionOption[] {
  switch (status) {
    case 'ADMINISTERED':
      return [{ action: 'PENDING', label: 'Reopen (recorded by mistake)' }];
    case 'NOT_GIVEN':
      return [
        { action: 'ADMINISTERED', label: 'Record as given' },
        { action: 'PENDING', label: 'Reopen' },
      ];
    case 'POSTPONED':
      return [
        { action: 'ADMINISTERED', label: 'Record as given' },
        { action: 'POSTPONED', label: 'Postpone again' },
        { action: 'NOT_GIVEN', label: 'Mark not given' },
      ];
    default:
      return [
        { action: 'ADMINISTERED', label: 'Record as given' },
        { action: 'POSTPONED', label: 'Postpone' },
        { action: 'NOT_GIVEN', label: 'Mark not given' },
      ];
  }
}

const NOTE_REQUIRED: Partial<Record<DoseAction, string>> = {
  POSTPONED: 'Please give a reason for postponing.',
  NOT_GIVEN: 'Please give a reason (for example: child unwell, parent declined, vaccine unavailable).',
  PENDING: 'Please explain why this record is being reopened.',
};

export default function DoseActionDialog({
  childId,
  childDateOfBirth,
  dose,
  onClose,
  onSaved,
}: DoseActionDialogProps) {
  const today = todayYmd();
  const options = optionsFor(dose.recordedStatus);

  const [action, setAction] = useState<DoseAction>(options[0].action);
  const [administeredOn, setAdministeredOn] = useState(today);
  const [newDueDate, setNewDueDate] = useState(addDaysYmd(today, 14));
  const [note, setNote] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validate = (): string | null => {
    if (action === 'ADMINISTERED') {
      if (!administeredOn) return 'Choose the date the dose was given.';
      if (administeredOn > today) return 'A dose cannot be recorded as given on a future date.';
      if (administeredOn < childDateOfBirth) return 'A dose cannot be given before the date of birth.';
      const batch = batchNumber.trim();
      if (batch && !BATCH_PATTERN.test(batch)) {
        return 'Batch number may contain letters, digits, - _ / and must be 2 to 30 characters.';
      }
    }
    if (action === 'POSTPONED') {
      if (!newDueDate) return 'Choose the new due date.';
      if (newDueDate <= today) return 'The new due date must be after today.';
      if (newDueDate > addDaysYmd(today, MAX_POSTPONE_DAYS)) {
        return `A dose cannot be postponed by more than ${MAX_POSTPONE_DAYS} days.`;
      }
    }
    const required = NOTE_REQUIRED[action];
    if (required && !note.trim()) return required;
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const trimmedNote = note.trim();
    const input: RecordDoseInput = { action };
    if (action === 'ADMINISTERED') {
      input.administeredOn = administeredOn;
      if (trimmedNote) input.note = trimmedNote;
      if (batchNumber.trim()) input.batchNumber = batchNumber.trim();
    }
    if (action === 'POSTPONED') {
      input.newDueDate = newDueDate;
      input.note = trimmedNote;
    }
    if (action === 'NOT_GIVEN' || action === 'PENDING') {
      input.note = trimmedNote;
    }

    setSubmitting(true);
    setError('');
    try {
      const updated = await recordDose(childId, dose.id, input);
      onSaved(updated);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Could not save this change. Check your connection and try again.')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dose-action-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="dose-action-title" className="text-lg font-semibold text-slate-900">
              {dose.vaccineName}
            </h2>
            <p className="text-sm text-slate-500">
              {dose.doseLabel} · due {dose.dueDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <fieldset className="mt-4">
          <legend className={labelClass}>What happened?</legend>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <label
                key={option.action}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  action === option.action
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="dose-action"
                  value={option.action}
                  checked={action === option.action}
                  onChange={() => {
                    setAction(option.action);
                    setError('');
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-400"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {action === 'ADMINISTERED' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="administeredOn" className={labelClass}>
                Date given
              </label>
              <input
                id="administeredOn"
                type="date"
                value={administeredOn}
                max={today}
                min={childDateOfBirth}
                onChange={(e) => setAdministeredOn(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="batchNumber" className={labelClass}>
                Batch / lot number <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="batchNumber"
                type="text"
                value={batchNumber}
                maxLength={30}
                placeholder="e.g. BCG-2231"
                onChange={(e) => setBatchNumber(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}

        {action === 'POSTPONED' && (
          <div className="mt-4">
            <label htmlFor="newDueDate" className={labelClass}>
              New due date
            </label>
            <input
              id="newDueDate"
              type="date"
              value={newDueDate}
              min={addDaysYmd(today, 1)}
              max={addDaysYmd(today, MAX_POSTPONE_DAYS)}
              onChange={(e) => setNewDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="dose-note" className={labelClass}>
            {NOTE_REQUIRED[action] ? 'Reason (required)' : 'Note (optional)'}
          </label>
          <textarea
            id="dose-note"
            value={note}
            rows={2}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-400">{note.length}/300 characters</p>
        </div>

        {action === 'ADMINISTERED' && (
          <p className="mt-3 text-xs text-slate-500">
            The dose is recorded at the facility your account is linked to (or the child&apos;s own
            facility when you are linked to it).
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} loadingText="Saving…">
            Save change
          </Button>
        </div>
      </form>
    </div>
  );
}