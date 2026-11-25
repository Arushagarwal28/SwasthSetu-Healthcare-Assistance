import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOptionalAssistedPatient } from '../../../context/AssistedPatientContext';

import ProgressSteps from '../../../components/assessment/ProgressSteps';
import SymptomSelectionStep from './SymptomSelectionStep';
import DetailsStep from './DetailsStep';
import ReviewStep from './ReviewStep';
import ResultStep from './ResultStep';
import FollowUpStep from './FollowUpStep';

import {
  createAssessment,
  addSymptomsToAssessment,
  submitAssessment,
  completeAssessment,
  fetchPatientMe,
} from '../../../api/assessments';

import {
  type PredictionDetails,
  type SelectedSymptom,
  type Symptom,
} from '../../../types/assessment';

type Step = 0 | 1 | 2 | 3 | 4;

export default function AssessmentPage() {
  const navigate = useNavigate();

  const assistedCtx = useOptionalAssistedPatient();
  const isHelperMode = !!assistedCtx;
  const assistedPatient = assistedCtx?.assistedPatient ?? null;

  const [step, setStep] = useState<Step>(0);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedSymptom[]>([]);

  const [initError, setInitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState('');
  const [prediction, setPrediction] =
    useState<PredictionDetails | null>(null);

  // Create assessment for:
  // 1. The logged-in patient
  // 2. The patient currently being assisted by a Helper
  useEffect(() => {
    const init = async () => {
      try {
        let patientId: string;

        if (isHelperMode) {
          if (!assistedPatient) {
            setInitError(
              'Select a patient to assist before starting an assessment.'
            );
            return;
          }

          patientId = assistedPatient.id;
        } else {
          const patient = await fetchPatientMe();
          patientId = patient.id;
        }

        const assessment = await createAssessment(patientId);
        setAssessmentId(assessment.id);
      } catch {
        setInitError(
          'Could not start a new assessment. Please try again.'
        );
      }
    };

    init();

    // This assessment should initialize only once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = new Set(selected.map((s) => s.symptomId));

  const toggleSymptom = (symptom: Symptom) => {
    setSelected((prev) => {
      const exists = prev.find(
        (s) => s.symptomId === symptom.id
      );

      if (exists) {
        return prev.filter(
          (s) => s.symptomId !== symptom.id
        );
      }

      return [
        ...prev,
        {
          symptomId: symptom.id,
          name: symptom.name,
          severity: 'MODERATE',
          durationDays: 1,
        },
      ];
    });
  };

  const updateDetail = (
    symptomId: string,
    field: 'severity' | 'durationDays',
    value: string | number
  ) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.symptomId === symptomId
          ? { ...s, [field]: value }
          : s
      )
    );
  };

  const handleConfirmSubmit = async () => {
    if (!assessmentId) return;

    setSubmitting(true);
    setReviewError('');

    try {
      await addSymptomsToAssessment(
        assessmentId,
        selected.map(
          ({ symptomId, severity, durationDays }) => ({
            symptomId,
            severity,
            durationDays,
          })
        )
      );

      await submitAssessment(assessmentId);

      setStep(3);
    } catch {
      setReviewError(
        'Something went wrong while submitting. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const runCompletion = async () => {
    if (!assessmentId) return;

    setResultLoading(true);
    setResultError('');

    try {
      const result = await completeAssessment(assessmentId);
      setPrediction(result.predictionDetails);
    } catch {
      setResultError(
        'The screening service is currently unavailable. Please try again in a moment.'
      );
    } finally {
      setResultLoading(false);
    }
  };

  const goBackToDashboard = () => {
    navigate(isHelperMode ? '/helper' : '/patient');
  };

  if (initError) {
    return (
      <div className="max-w-lg mx-auto mt-10 text-center px-4">
        <p className="text-red-600 mb-4">{initError}</p>

        <button
          onClick={goBackToDashboard}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Health Assessment
          </h1>

          {isHelperMode && assistedPatient && (
            <p className="text-sm text-gray-500">
              Assisting: {assistedPatient.fullName}
            </p>
          )}
        </div>

        <button
          onClick={goBackToDashboard}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>

      <ProgressSteps currentStep={step} />

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        {!assessmentId && !initError && (
          <div className="text-center py-12 text-gray-500">
            Starting assessment…
          </div>
        )}

        {assessmentId && step === 0 && (
          <SymptomSelectionStep
            selectedIds={selectedIds}
            onToggle={toggleSymptom}
            onNext={() => setStep(1)}
            onCancel={goBackToDashboard}
          />
        )}

        {assessmentId && step === 1 && (
          <DetailsStep
            selected={selected}
            onChange={updateDetail}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}

        {assessmentId && step === 2 && (
          <ReviewStep
            selected={selected}
            submitting={submitting}
            error={reviewError}
            onBack={() => setStep(1)}
            onConfirm={handleConfirmSubmit}
          />
        )}

        {assessmentId && step === 3 && (
          <FollowUpStep
            assessmentId={assessmentId}
            onResolved={() => {
              setStep(4);
              runCompletion();
            }}
          />
        )}
        {step === 4 && (
          <ResultStep
          prediction={prediction}
          loading={resultLoading}
          error={resultError}
          assessmentId={assessmentId!}
          backTo={isHelperMode ? '/helper' : '/patient'}
          onDone={() => navigate(isHelperMode ? '/helper' : '/patient')}
          onRetry={runCompletion}
          />
        )}

      </div>
    </div>
  );
}