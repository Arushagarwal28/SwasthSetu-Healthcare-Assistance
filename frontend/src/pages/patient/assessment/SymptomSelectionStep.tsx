import { useEffect, useMemo, useState } from 'react';
import { fetchSymptoms } from '../../../api/symptoms';
import { type Symptom } from '../../../types/assessment';

interface Props {
  selectedIds: Set<string>;
  onToggle: (symptom: Symptom) => void;
  onNext: () => void;
  onCancel: () => void;
}

export default function SymptomSelectionStep({ selectedIds, onToggle, onNext, onCancel }: Props) {
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSymptoms()
      .then(setSymptoms)
      .catch(() => setError('Could not load symptoms. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const filtered = symptoms.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
    const groups: Record<string, Symptom[]> = {};
    for (const s of filtered) {
      const cat = s.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    }
    return groups;
  }, [symptoms, search]);

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading symptoms…</div>;
  }

  if (error) {
    return <div className="text-center py-12 text-red-600">{error}</div>;
  }

  if (symptoms.length === 0) {
    return <div className="text-center py-12 text-gray-500">No symptoms available.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Select your symptoms</h2>
        <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
      </div>

      <input
        type="text"
        placeholder="Search symptoms…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md divide-y">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {category}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {items.map((symptom) => (
                <label
                  key={symptom.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(symptom.id)}
                    onChange={() => onToggle(symptom)}
                    className="accent-blue-600"
                  />
                  {symptom.name}
                </label>
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-center text-gray-400 text-sm py-6">No symptoms match your search.</p>
        )}
      </div>

      <div className="flex justify-between mt-6">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={selectedIds.size === 0}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          Next: Add details
        </button>
      </div>
    </div>
  );
}