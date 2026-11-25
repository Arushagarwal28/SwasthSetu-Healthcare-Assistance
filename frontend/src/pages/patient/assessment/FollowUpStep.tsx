import { useEffect, useState } from 'react';
import { getNextQuestion, addFollowUpAnswer } from '../../../api/assessments';
import { type NextQuestionResult } from '../../../types/assessment';

interface Props {
  assessmentId: string;
  onResolved: () => void;
}

export default function FollowUpStep({ assessmentId, onResolved }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<NextQuestionResult | null>(null);
  const [answering, setAnswering] = useState(false);

  const fetchNext = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getNextQuestion(assessmentId);
      setCurrent(result);
      if (!result.needsFollowup) {
        onResolved();
      }
    } catch {
      setError('Could not check for follow-up questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = async (answer: 'yes' | 'no') => {
    if (!current?.question) return;
    setAnswering(true);
    setError('');
    try {
      await addFollowUpAnswer(assessmentId, current.question.questionText, answer, current.question.symptomId);
      await fetchNext();
    } catch {
      setError('Could not save your answer. Please try again.');
    } finally {
      setAnswering(false);
    }
  };

  if (loading && !current) {
    return <div className="text-center py-12 text-gray-500">Checking if we need more information…</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchNext}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!current?.needsFollowup || !current.question) {
    return (
      <div className="text-center py-12 text-gray-500">
        No additional questions needed. Preparing your result…
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">One more question</h2>
      <p className="text-sm text-gray-500 mb-6">
        Based on your symptoms so far, this could help narrow things down.
      </p>

      <div className="border border-gray-200 rounded-md p-5 text-center mb-6">
        <p className="text-base font-medium text-gray-900">{current.question.questionText}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleAnswer('no')}
          disabled={answering}
          className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          No
        </button>
        <button
          onClick={() => handleAnswer('yes')}
          disabled={answering}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300"
        >
          Yes
        </button>
      </div>
      {answering && <p className="text-center text-xs text-gray-400 mt-3">Saving your answer…</p>}
    </div>
  );
}