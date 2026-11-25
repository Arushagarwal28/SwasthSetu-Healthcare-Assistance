
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { canHelperAccessPatient } from '../helpers/helper.service';
import { getPrediction } from '../prediction/prediction.service';
import { getNextQuestion } from '../prediction/prediction.service';

const MAX_FOLLOWUP_ROUNDS = 10;

const CONFIDENCE_THRESHOLD_STAGES: { maxRound: number; threshold: number }[] = [
  { maxRound: 5, threshold: 0.70 },
  { maxRound: 8, threshold: 0.60 },
  { maxRound: 10, threshold: 0.50 },
];

const getThresholdForRound = (roundNumber: number): number => {
  const stage = CONFIDENCE_THRESHOLD_STAGES.find((s) => roundNumber <= s.maxRound);

  if (stage) {
    return stage.threshold;
  }

  return CONFIDENCE_THRESHOLD_STAGES.at(-1)?.threshold ?? 0.5;
};

// Shared guard — reused across every assessment action
export const assertCanActOnPatient = async (
  requestingUser: { userId: string; role: string },
  patientId: string
) => {
  // Only Patients and Helpers can perform patient assessment actions
  if (requestingUser.role !== 'PATIENT' && requestingUser.role !== 'HELPER') {
    throw new AppError('You do not have permission to act on this patient', 403);
  }

  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new AppError('Patient not found', 404);

  if (requestingUser.role === 'PATIENT' && patient.userId !== requestingUser.userId) {
    throw new AppError('You do not have permission to act on this patient', 403);
  }

  if (requestingUser.role === 'HELPER') {
    const authorized = await canHelperAccessPatient(requestingUser.userId, patientId);
    if (!authorized) {
      throw new AppError('You do not have permission to act on this patient', 403);
    }
  }

  return patient;
};

export const createAssessment = async (
  requestingUser: { userId: string; role: string },
  patientId: string
) => {
  await assertCanActOnPatient(requestingUser, patientId);

  return prisma.assessment.create({
    data: {
      patientId,
      createdById: requestingUser.userId,
      status: 'CREATED',
    },
  });
};

export const getAssessmentById = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { symptoms: { include: { symptom: true } }, followUpAnswers: true },
  });

  if (!assessment) throw new AppError('Assessment not found', 404);

  await assertCanActOnPatient(requestingUser, assessment.patientId);
  return assessment;
};

const assertStatus = (
  assessment: { status: string },
  expected: string[],
  action: string
) => {
  if (!expected.includes(assessment.status)) {
    throw new AppError(
      `Cannot ${action} — assessment is in status ${assessment.status}`,
      400
    );
  }
};

export const addSymptoms = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string,
  symptoms: { symptomId: string; severity?: string; durationDays?: number }[]
) => {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });

  if (!assessment) throw new AppError('Assessment not found', 404);

  await assertCanActOnPatient(requestingUser, assessment.patientId);
  assertStatus(assessment, ['CREATED', 'SYMPTOMS_ADDED'], 'add symptoms');

  await prisma.assessmentSymptom.createMany({
    data: symptoms.map((s) => ({
      assessmentId,
      symptomId: s.symptomId,
      severity: s.severity ?? null,
      durationDays: s.durationDays ?? null,
    })),
    skipDuplicates: true,
  });

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: 'SYMPTOMS_ADDED' },
    include: { symptoms: { include: { symptom: true } } },
  });
};

export const addFollowUpAnswer = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string,
  question: string,
  answer: string,
  symptomId?: string
) => {
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });

  if (!assessment) throw new AppError('Assessment not found', 404);

  await assertCanActOnPatient(requestingUser, assessment.patientId);
  assertStatus(
    assessment,
    ['SYMPTOMS_ADDED', 'IN_PROGRESS', 'SUBMITTED'],
    'add follow-up answer'
  );

  await prisma.followUpAnswer.create({
    data: { assessmentId, question, answer, symptomId: symptomId ?? null },
  });

  if (symptomId && answer.trim().toLowerCase() === 'yes') {
    await prisma.assessmentSymptom.upsert({
      where: { assessmentId_symptomId: { assessmentId, symptomId } },
      update: {},
      create: { assessmentId, symptomId },
    });
  }

  const newStatus = assessment.status === 'SUBMITTED' ? 'SUBMITTED' : 'IN_PROGRESS';

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: newStatus },
    include: { followUpAnswers: true, symptoms: { include: { symptom: true } } },
  });
};

export const submitAssessment = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { symptoms: true },
  });

  if (!assessment) throw new AppError('Assessment not found', 404);

  await assertCanActOnPatient(requestingUser, assessment.patientId);
  assertStatus(assessment, ['SYMPTOMS_ADDED', 'IN_PROGRESS'], 'submit');

  if (assessment.symptoms.length === 0) {
    throw new AppError('Cannot submit an assessment with no symptoms', 400);
  }

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: { status: 'SUBMITTED' },
  });
};

export const completeAssessment = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { symptoms: { include: { symptom: true } } },
  });

  if (!assessment) throw new AppError('Assessment not found', 404);

  await assertCanActOnPatient(requestingUser, assessment.patientId);
  assertStatus(assessment, ['SUBMITTED'], 'complete');

  // Use symptom.key (ML vocabulary), not symptom.name (display label)
  const symptomKeys = assessment.symptoms.map((s) => s.symptom.key);

  const prediction = await getPrediction(symptomKeys);

  return prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      predictedDisease: prediction.predicted_disease,
      predictionConfidence: prediction.confidence,
      predictionDetails: prediction as any,
    },
  });
};

export const getFollowUpQuestion = async (
  requestingUser: { userId: string; role: string },
  assessmentId: string
) => {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      symptoms: { include: { symptom: true } },
      followUpAnswers: { include: { symptom: true } },
    },
  });

  if (!assessment) throw new AppError('Assessment not found', 404);

  await assertCanActOnPatient(requestingUser, assessment.patientId);
  assertStatus(assessment, ['SUBMITTED'], 'get follow-up question');

  const knownKeys = assessment.symptoms.map((s) => s.symptom.key);
  const askedRounds = assessment.followUpAnswers.filter((a) => a.symptomId).length;

  if (askedRounds >= MAX_FOLLOWUP_ROUNDS) {
    return { needsFollowup: false, reachedMaxRounds: true, question: null };
  }

  const roundNumber = askedRounds + 1;
  const threshold = getThresholdForRound(roundNumber);

  const excludedKeys = assessment.followUpAnswers
    .filter((a) => a.symptom)
    .map((a) => a.symptom!.key);

  const result = await getNextQuestion(knownKeys, excludedKeys, threshold);

  if (!result.needs_followup || !result.next_symptom_key) {
    return { needsFollowup: false, reachedMaxRounds: false, question: null };
  }

  const symptom = await prisma.symptom.findUnique({
    where: { key: result.next_symptom_key },
  });

  if (!symptom) {
    return { needsFollowup: false, reachedMaxRounds: false, question: null };
  }

  return {
    needsFollowup: true,
    reachedMaxRounds: false,
    question: {
      symptomId: symptom.id,
      symptomName: symptom.name,
      questionText: `Do you also have ${symptom.name.toLowerCase()}?`,
    },
  };
};
