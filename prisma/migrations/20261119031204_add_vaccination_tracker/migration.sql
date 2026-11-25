-- CreateEnum
CREATE TYPE "AgeUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS', 'YEARS');

-- CreateEnum
CREATE TYPE "ApplicabilityRule" AS ENUM ('ALWAYS', 'JE_ENDEMIC_DISTRICT', 'FEMALE_ONLY');

-- CreateEnum
CREATE TYPE "DoseRecordStatus" AS ENUM ('PENDING', 'ADMINISTERED', 'POSTPONED', 'NOT_GIVEN');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('TWO_DAYS_BEFORE', 'ONE_DAY_BEFORE', 'ON_DUE_DATE', 'ONE_DAY_AFTER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('SMS', 'IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'DELIVERED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('EN', 'HI');

-- CreateEnum
CREATE TYPE "ChildGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "district" TEXT,
ADD COLUMN     "pinCode" TEXT;

-- CreateTable
CREATE TABLE "vaccines" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccine_schedule_entries" (
    "id" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "doseLabel" TEXT NOT NULL,
    "ageValue" INTEGER NOT NULL,
    "ageUnit" "AgeUnit" NOT NULL,
    "ageLabel" TEXT NOT NULL,
    "applicability" "ApplicabilityRule" NOT NULL DEFAULT 'ALWAYS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccine_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_vaccines" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "vaccineId" TEXT NOT NULL,
    "sessionInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_vaccines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "recordNumber" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "ChildGender" NOT NULL,
    "birthWeightGrams" INTEGER,
    "motherName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "guardianName" TEXT,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "email" TEXT,
    "addressLine" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "jeEndemicArea" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" "PreferredLanguage" NOT NULL DEFAULT 'EN',
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "smsConsentAt" TIMESTAMP(3),
    "consentRecordedById" TEXT,
    "assignedFacilityId" TEXT,
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_doses" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "scheduleEntryId" TEXT,
    "vaccineCode" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER NOT NULL,
    "doseLabel" TEXT NOT NULL,
    "ageLabel" TEXT NOT NULL,
    "originalDueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "recordedStatus" "DoseRecordStatus" NOT NULL DEFAULT 'PENDING',
    "administeredOn" DATE,
    "administeredFacilityId" TEXT,
    "recordedById" TEXT,
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_doses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_dose_events" (
    "id" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "fromStatus" "DoseRecordStatus",
    "toStatus" "DoseRecordStatus" NOT NULL,
    "fromDueDate" DATE,
    "toDueDate" DATE,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_dose_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_reminders" (
    "id" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "dueDateSnapshot" DATE NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccination_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_deliveries" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL,
    "provider" TEXT,
    "recipientMasked" TEXT,
    "templateKey" TEXT,
    "providerMessageId" TEXT,
    "providerResponse" JSONB,
    "errorMessage" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vaccination_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "doseId" TEXT NOT NULL,
    "reminderId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vaccination_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vaccines_code_key" ON "vaccines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vaccine_schedule_entries_vaccineId_doseNumber_key" ON "vaccine_schedule_entries"("vaccineId", "doseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "facility_vaccines_facilityId_vaccineId_key" ON "facility_vaccines"("facilityId", "vaccineId");

-- CreateIndex
CREATE UNIQUE INDEX "children_recordNumber_key" ON "children"("recordNumber");

-- CreateIndex
CREATE INDEX "children_assignedFacilityId_idx" ON "children"("assignedFacilityId");

-- CreateIndex
CREATE INDEX "children_registeredById_idx" ON "children"("registeredById");

-- CreateIndex
CREATE INDEX "children_primaryMobile_idx" ON "children"("primaryMobile");

-- CreateIndex
CREATE INDEX "children_pinCode_idx" ON "children"("pinCode");

-- CreateIndex
CREATE INDEX "children_dateOfBirth_idx" ON "children"("dateOfBirth");

-- CreateIndex
CREATE INDEX "child_doses_childId_idx" ON "child_doses"("childId");

-- CreateIndex
CREATE INDEX "child_doses_dueDate_recordedStatus_idx" ON "child_doses"("dueDate", "recordedStatus");

-- CreateIndex
CREATE INDEX "child_doses_administeredFacilityId_idx" ON "child_doses"("administeredFacilityId");

-- CreateIndex
CREATE UNIQUE INDEX "child_doses_childId_vaccineCode_doseNumber_key" ON "child_doses"("childId", "vaccineCode", "doseNumber");

-- CreateIndex
CREATE INDEX "child_dose_events_doseId_idx" ON "child_dose_events"("doseId");

-- CreateIndex
CREATE INDEX "vaccination_reminders_status_scheduledFor_idx" ON "vaccination_reminders"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "vaccination_reminders_childId_idx" ON "vaccination_reminders"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_reminders_doseId_kind_dueDateSnapshot_key" ON "vaccination_reminders"("doseId", "kind", "dueDateSnapshot");

-- CreateIndex
CREATE INDEX "reminder_deliveries_reminderId_idx" ON "reminder_deliveries"("reminderId");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_deliveries_reminderId_channel_attemptNumber_key" ON "reminder_deliveries"("reminderId", "channel", "attemptNumber");

-- CreateIndex
CREATE INDEX "vaccination_notifications_userId_readAt_idx" ON "vaccination_notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "vaccination_notifications_userId_reminderId_key" ON "vaccination_notifications"("userId", "reminderId");

-- CreateIndex
CREATE INDEX "facilities_pinCode_idx" ON "facilities"("pinCode");

-- AddForeignKey
ALTER TABLE "vaccine_schedule_entries" ADD CONSTRAINT "vaccine_schedule_entries_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_vaccines" ADD CONSTRAINT "facility_vaccines_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_vaccines" ADD CONSTRAINT "facility_vaccines_vaccineId_fkey" FOREIGN KEY ("vaccineId") REFERENCES "vaccines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_assignedFacilityId_fkey" FOREIGN KEY ("assignedFacilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_doses" ADD CONSTRAINT "child_doses_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_doses" ADD CONSTRAINT "child_doses_scheduleEntryId_fkey" FOREIGN KEY ("scheduleEntryId") REFERENCES "vaccine_schedule_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_doses" ADD CONSTRAINT "child_doses_administeredFacilityId_fkey" FOREIGN KEY ("administeredFacilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_doses" ADD CONSTRAINT "child_doses_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_dose_events" ADD CONSTRAINT "child_dose_events_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "child_doses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_dose_events" ADD CONSTRAINT "child_dose_events_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "child_doses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_reminders" ADD CONSTRAINT "vaccination_reminders_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "vaccination_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_notifications" ADD CONSTRAINT "vaccination_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_notifications" ADD CONSTRAINT "vaccination_notifications_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_notifications" ADD CONSTRAINT "vaccination_notifications_doseId_fkey" FOREIGN KEY ("doseId") REFERENCES "child_doses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vaccination_notifications" ADD CONSTRAINT "vaccination_notifications_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "vaccination_reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
