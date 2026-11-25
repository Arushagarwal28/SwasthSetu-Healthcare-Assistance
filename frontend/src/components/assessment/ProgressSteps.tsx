const STEPS = ['Symptoms', 'Details', 'Review', 'Follow-up', 'Result'] as const;
interface Props {
  currentStep: number; // 0-indexed
}

export default function ProgressSteps({ currentStep }: Props) {
  return (
    <div className="flex items-center w-full mb-8">
      {STEPS.map((label, idx) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                idx < currentStep
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : idx === currentStep
                  ? 'border-blue-600 text-blue-600'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span
              className={`mt-1 text-xs ${
                idx <= currentStep ? 'text-gray-800 font-medium' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${idx < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}