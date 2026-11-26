import { useState } from 'react';
import Button from '../../../components/ui/Button';
import { getApiErrorMessage } from '../../../utils/errors';
import type { CorrectionField, CorrectionRequestItem, ReportTestDto } from '../types';

interface Props {
  test: ReportTestDto;
  onClose: () => void;
  onSubmit: (items: CorrectionRequestItem[]) => Promise<void>;
}

const FIELD_OPTIONS: { value: CorrectionField; label: string; hint: string }[] = [
  { value: 'value', label: 'Result value', hint: 'The number or word printed for this test.' },
  { value: 'unit', label: 'Unit', hint: 'The unit printed next to the value, e.g. g/dL.' },
  {
    value: 'reference_range',
    label: 'Reference range',
    hint: 'The range printed on the report, e.g. 4.0 - 11.0.',
  },
  { value: 'name', label: 'Test name', hint: 'Use the name exactly as printed on the report.' },
];

/**
 * Manual verification of one result.
 *
 * The extracted value is shown before editing and is never overwritten on the
 * server: a correction is stored alongside it with the verifier and a note.
 */
export default function CorrectionDialog({ test, onClose, onSubmit }: Props) {
  const [field, setField] = useState<CorrectionField>('value');
  const [value, setValue] = useState(test.value.raw ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFieldChange = (next: CorrectionField) => {
    setField(next);
    setError('');
    if (next === 'value') setValue(test.value.raw ?? '');
    else if (next === 'unit') setValue(test.value.unit ?? '');
    else if (next === 'reference_range') setValue(test.reference.text ?? '');
    else setValue(test.nameRaw || test.name);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter the value exactly as it is printed on the report.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit([
        {
          testId: test.id,
          field,
          corrected: trimmed,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      ]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'The correction could not be saved. Please try again.'));
      setSubmitting(false);
    }
  };

  const selected = FIELD_OPTIONS.find((option) => option.value === field);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="correction-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 id="correction-title" className="text-lg font-semibold text-slate-900">
          Verify or correct this result
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {test.name}
          {test.needsReview && (
            <span className="ml-1 font-medium text-amber-800">
              — currently marked as needing verification
            </span>
          )}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Reading in use</dt>
            <dd className="font-medium text-slate-900">
              {test.value.raw ?? 'Not printed'}
              {test.value.unit ? ` ${test.value.unit}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Printed reference</dt>
            <dd className="text-slate-900">{test.reference.text ?? 'Not printed'}</dd>
          </div>
          {test.corrected && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Originally extracted</dt>
              <dd className="text-slate-900">
                {test.extracted.value ?? '—'} {test.extracted.unit ?? ''}{' '}
                <span className="text-xs text-slate-500">
                  (kept for reference; corrections never erase the original)
                </span>
              </dd>
            </div>
          )}
        </dl>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="correction-field" className="mb-1.5 block text-sm font-medium text-slate-700">
              What is wrong?
            </label>
            <select
              id="correction-field"
              value={field}
              onChange={(event) => handleFieldChange(event.target.value as CorrectionField)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">{selected?.hint}</p>
          </div>

          <div>
            <label htmlFor="correction-value" className="mb-1.5 block text-sm font-medium text-slate-700">
              Correct value
            </label>
            <input
              id="correction-value"
              type="text"
              value={value}
              maxLength={120}
              onChange={(event) => setValue(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label htmlFor="correction-note" className="mb-1.5 block text-sm font-medium text-slate-700">
              Note <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="correction-note"
              type="text"
              value={note}
              maxLength={300}
              placeholder="For example: value unclear in the photo"
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-500">
            The status and the explanations are recalculated from the corrected value and the range
            printed on the report.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} loadingText="Saving…">
              Save correction
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
