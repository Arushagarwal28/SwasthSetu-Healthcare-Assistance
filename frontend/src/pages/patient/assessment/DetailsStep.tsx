import { type SelectedSymptom,type Severity } from '../../../types/assessment';

interface Props {
  selected: SelectedSymptom[];
  onChange: (symptomId: string, field: 'severity' | 'durationDays', value: string | number) => void;
  onBack: () => void;
  onNext: () => void;
}

const SEVERITIES: Severity[] = ['MILD', 'MODERATE', 'SEVERE'];

export default function DetailsStep({ selected, onChange, onBack, onNext }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Severity & duration</h2>
      <p className="text-sm text-gray-500 mb-4">
        For each symptom, tell us how severe it is and how long you've had it.
      </p>

      <div className="space-y-3">
        {selected.map((s) => (
          <div key={s.symptomId} className="border border-gray-200 rounded-md p-3">
            <p className="font-medium text-sm text-gray-900 mb-2">{s.name}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Severity</label>
                <select
                  value={s.severity}
                  onChange={(e) => onChange(s.symptomId, 'severity', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {SEVERITIES.map((sev) => (
                    <option key={sev} value={sev}>
                      {sev.charAt(0) + sev.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Duration (days)</label>
                <input
                  type="number"
                  min={0}
                  value={s.durationDays}
                  onChange={(e) => onChange(s.symptomId, 'durationDays', Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Back
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Next: Review
        </button>
      </div>
    </div>
  );
}