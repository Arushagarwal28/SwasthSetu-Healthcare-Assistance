-- CreateEnum
CREATE TYPE "ReportProcessingStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportTestStatus" AS ENUM ('WITHIN_RANGE', 'HIGH', 'LOW', 'ABNORMAL', 'UNKNOWN', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ExplanationKind" AS ENUM ('REPORT_SUMMARY', 'TEST');

-- CreateEnum
CREATE TYPE "CorrectionField" AS ENUM ('VALUE', 'UNIT', 'REFERENCE_RANGE', 'NAME');

-- CreateEnum
CREATE TYPE "ReportAuditAction" AS ENUM ('UPLOAD', 'PARSE_SUCCESS', 'PARSE_FAILURE', 'VIEW', 'EXPORT', 'CORRECT', 'SHARE', 'REVOKE_SHARE', 'COMPARE', 'DELETE');

-- CreateTable
CREATE TABLE "medical_reports" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByRole" "Role" NOT NULL,
    "title" TEXT,
    "originalFilename" TEXT,
    "fileMimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "ReportProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorCode" TEXT,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "testCount" INTEGER NOT NULL DEFAULT 0,
    "needsReviewCount" INTEGER NOT NULL DEFAULT 0,
    "reportTypePrimary" TEXT,
    "reportTypeDetected" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reportTypeMixed" BOOLEAN NOT NULL DEFAULT false,
    "reportDate" TIMESTAMP(3),
    "processingMs" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_report_tests" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "canonicalId" TEXT,
    "canonicalName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "nameRaw" TEXT NOT NULL,
    "nameMatchMethod" TEXT,
    "nameMatchScore" DOUBLE PRECISION,
    "extractedValueRaw" TEXT,
    "extractedValueNumeric" DOUBLE PRECISION,
    "extractedUnitRaw" TEXT,
    "extractedReferenceText" TEXT,
    "valueRaw" TEXT,
    "valueNumeric" DOUBLE PRECISION,
    "valueQualitative" TEXT,
    "unitRaw" TEXT,
    "unitNormalized" TEXT,
    "unitKnown" BOOLEAN NOT NULL DEFAULT false,
    "referenceKind" TEXT NOT NULL DEFAULT 'unknown',
    "referenceLow" DOUBLE PRECISION,
    "referenceHigh" DOUBLE PRECISION,
    "referenceLowInclusive" BOOLEAN NOT NULL DEFAULT true,
    "referenceHighInclusive" BOOLEAN NOT NULL DEFAULT true,
    "referenceText" TEXT,
    "labFlagRaw" TEXT,
    "status" "ReportTestStatus" NOT NULL DEFAULT 'UNKNOWN',
    "statusBasis" TEXT NOT NULL,
    "statusReason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationChecked" BOOLEAN NOT NULL DEFAULT false,
    "verificationPrimary" TEXT,
    "verificationSecondary" TEXT,
    "verificationAgreement" TEXT,
    "pageIndex" INTEGER NOT NULL DEFAULT 0,
    "lineIndex" INTEGER NOT NULL DEFAULT 0,
    "rowIndex" INTEGER NOT NULL DEFAULT 0,
    "pageSource" TEXT NOT NULL DEFAULT 'pdf_text',
    "correctedAt" TIMESTAMP(3),
    "correctedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_report_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_explanations" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "testId" TEXT,
    "kind" "ExplanationKind" NOT NULL,
    "language" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_corrections" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "field" "CorrectionField" NOT NULL,
    "originalValue" JSONB NOT NULL,
    "correctedValue" JSONB NOT NULL,
    "correctedById" TEXT NOT NULL,
    "note" TEXT,
    "resultingStatus" "ReportTestStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_shares" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_audit_logs" (
    "id" TEXT NOT NULL,
    "reportId" TEXT,
    "reportRef" TEXT,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" "ReportAuditAction" NOT NULL,
    "detail" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medical_reports_patientId_createdAt_idx" ON "medical_reports"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "medical_reports_patientId_reportDate_idx" ON "medical_reports"("patientId", "reportDate");

-- CreateIndex
CREATE INDEX "medical_reports_uploadedById_createdAt_idx" ON "medical_reports"("uploadedById", "createdAt");

-- CreateIndex
CREATE INDEX "medical_reports_status_idx" ON "medical_reports"("status");

-- CreateIndex
CREATE INDEX "medical_reports_reportTypePrimary_idx" ON "medical_reports"("reportTypePrimary");

-- CreateIndex
CREATE INDEX "medical_report_tests_canonicalId_idx" ON "medical_report_tests"("canonicalId");

-- CreateIndex
CREATE INDEX "medical_report_tests_status_idx" ON "medical_report_tests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "medical_report_tests_reportId_index_key" ON "medical_report_tests"("reportId", "index");

-- CreateIndex
CREATE INDEX "report_explanations_reportId_language_idx" ON "report_explanations"("reportId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "report_explanations_reportId_scopeKey_language_key" ON "report_explanations"("reportId", "scopeKey", "language");

-- CreateIndex
CREATE INDEX "report_corrections_reportId_createdAt_idx" ON "report_corrections"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "report_corrections_testId_createdAt_idx" ON "report_corrections"("testId", "createdAt");

-- CreateIndex
CREATE INDEX "report_shares_userId_revokedAt_idx" ON "report_shares"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "report_shares_reportId_userId_key" ON "report_shares"("reportId", "userId");

-- CreateIndex
CREATE INDEX "report_audit_logs_reportId_createdAt_idx" ON "report_audit_logs"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "report_audit_logs_actorId_createdAt_idx" ON "report_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "report_audit_logs_action_createdAt_idx" ON "report_audit_logs"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_reports" ADD CONSTRAINT "medical_reports_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_report_tests" ADD CONSTRAINT "medical_report_tests_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "medical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_explanations" ADD CONSTRAINT "report_explanations_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "medical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_explanations" ADD CONSTRAINT "report_explanations_testId_fkey" FOREIGN KEY ("testId") REFERENCES "medical_report_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_corrections" ADD CONSTRAINT "report_corrections_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "medical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_corrections" ADD CONSTRAINT "report_corrections_testId_fkey" FOREIGN KEY ("testId") REFERENCES "medical_report_tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_corrections" ADD CONSTRAINT "report_corrections_correctedById_fkey" FOREIGN KEY ("correctedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "medical_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_audit_logs" ADD CONSTRAINT "report_audit_logs_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "medical_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_audit_logs" ADD CONSTRAINT "report_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
