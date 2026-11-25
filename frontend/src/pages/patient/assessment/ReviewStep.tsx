import {type SelectedSymptom } from '../../../types/assessment';

interface Props {
  selected: SelectedSymptom[];
  submitting: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
}

export default function ReviewStep({ selected, submitting, error, onBack, onConfirm }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Review before submitting</h2>

      <div className="border border-gray-200 rounded-md divide-y mb-4">
        {selected.map((s) => (
          <div key={s.symptomId} className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="font-medium text-gray-800">{s.name}</span>
            <span className="text-gray-500">
              {s.severity.charAt(0) + s.severity.slice(1).toLowerCase()} · {s.durationDays}{' '}
              {s.durationDays === 1 ? 'day' : 'days'}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Once submitted, this assessment will be sent for screening. You won't be able to add more
        symptoms after this step.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex justify-between mt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300"
        >
          {submitting ? 'Submitting…' : 'Submit assessment'}
        </button>
      </div>
    </div>
  );
}