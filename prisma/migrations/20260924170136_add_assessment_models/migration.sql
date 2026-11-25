-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('CREATED', 'SYMPTOMS_ADDED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_symptoms" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,
    "severity" TEXT,
    "durationDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_answers" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_name_key" ON "symptoms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_symptoms_assessmentId_symptomId_key" ON "assessment_symptoms"("assessmentId", "symptomId");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_symptoms" ADD CONSTRAINT "assessment_symptoms_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_symptoms" ADD CONSTRAINT "assessment_symptoms_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "symptoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_answers" ADD CONSTRAINT "follow_up_answers_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
