import { type PredictionDetails } from '../../../types/assessment';
import { useNavigate } from 'react-router-dom';

interface Props {
  prediction: PredictionDetails | null;
  loading: boolean;
  error: string;
  assessmentId: string;
  backTo: string;
  onDone: () => void;
  onRetry: () => void;
}

function getConfidenceTier(confidence: number): {
  label: string;
  className: string;
} {
  const pct = confidence * 100;

  if (pct >= 70) {
    return {
      label: 'Higher confidence',
      className: 'bg-green-50 text-green-700 border-green-200',
    };
  }

  if (pct >= 60) {
    return {
      label: 'Moderate confidence',
      className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    };
  }

  if (pct >= 50) {
    return {
      label: 'Low confidence',
      className: 'bg-orange-50 text-orange-700 border-orange-200',
    };
  }

  return {
    label: 'Inconclusive — very low confidence',
    className: 'bg-red-50 text-red-700 border-red-200',
  };
}

export default function ResultStep({
  prediction,
  loading,
  error,
  assessmentId,
  backTo,
  onDone,
  onRetry,
}: Props) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Generating screening result…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>

        <button
          onClick={onRetry}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="text-center py-12 text-gray-500">
        No result available.
      </div>
    );
  }

  const tier = getConfidenceTier(prediction.confidence);

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-5">
        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
          Model prediction / screening result
        </p>

        <p className="text-sm text-blue-900">
          This is an automated screening suggestion, not a confirmed medical
          diagnosis. Please consult a qualified healthcare provider.
        </p>
      </div>

      <div className="text-center mb-6">
        <p className="text-2xl font-semibold text-gray-900">
          {prediction.predicted_disease}
        </p>

        <span
          className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium border ${tier.className}`}
        >
          {tier.label} — {(prediction.confidence * 100).toFixed(1)}%
        </span>
      </div>

      {prediction.confidence < 0.5 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-5 text-sm text-red-800">
          This result is inconclusive based on the symptoms provided. Please
          consult a healthcare provider directly rather than relying on this
          screening.
        </div>
      )}

      {prediction.top_predictions.length > 1 && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Other possibilities considered
          </p>

          <div className="space-y-1.5">
            {prediction.top_predictions.slice(1).map((p) => (
              <div
                key={p.disease}
                className="flex justify-between text-sm border border-gray-200 rounded-md px-3 py-2"
              >
                <span className="text-gray-700">{p.disease}</span>

                <span className="text-gray-500">
                  {(p.probability * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="w-full mb-3 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        onClick={() =>
          navigate(`${backTo}/assessment/${assessmentId}/recommendations`)
        }
      >
        View Recommended Facilities
      </button>

      <button
        onClick={onDone}
        className="w-full py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
      >
        Return to dashboard
      </button>
    </div>
  );
}