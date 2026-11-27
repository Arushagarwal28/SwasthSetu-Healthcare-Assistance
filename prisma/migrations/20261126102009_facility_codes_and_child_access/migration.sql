-- CreateEnum
CREATE TYPE "FacilityCodeStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "FacilityCodeAuditAction" AS ENUM ('CREATED', 'ROTATED', 'REVOKED', 'EXPIRY_CHANGED', 'REGISTRATION_USED');

-- CreateEnum
CREATE TYPE "ChildAccessVerificationMethod" AS ENUM ('MANUAL_ATTESTED', 'OTP');

-- CreateEnum
CREATE TYPE "ChildAccessAuditAction" AS ENUM ('VERIFICATION_SUCCEEDED', 'VERIFICATION_FAILED', 'GRANT_EXTENDED', 'CROSS_FACILITY_READ', 'CROSS_FACILITY_DOSE_RECORDED');

-- CreateTable
CREATE TABLE "facility_registration_codes" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "codeLookup" TEXT NOT NULL,
    "status" "FacilityCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_registration_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_code_audits" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "codeId" TEXT,
    "actorId" TEXT,
    "action" "FacilityCodeAuditAction" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_code_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_access_grants" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "verificationMethod" "ChildAccessVerificationMethod" NOT NULL DEFAULT 'MANUAL_ATTESTED',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_access_audits" (
    "id" TEXT NOT NULL,
    "childId" TEXT,
    "actorId" TEXT,
    "facilityId" TEXT,
    "action" "ChildAccessAuditAction" NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_access_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facility_registration_codes_codeLookup_key" ON "facility_registration_codes"("codeLookup");

-- One ACTIVE registration code per facility, enforced by the database itself.
-- Prisma cannot express a partial unique index, so it is added by hand here.
CREATE UNIQUE INDEX "facility_registration_codes_one_active_per_facility"
    ON "facility_registration_codes"("facilityId") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "facility_registration_codes_facilityId_status_idx" ON "facility_registration_codes"("facilityId", "status");

-- CreateIndex
CREATE INDEX "facility_code_audits_facilityId_createdAt_idx" ON "facility_code_audits"("facilityId", "createdAt");

-- CreateIndex
CREATE INDEX "facility_code_audits_action_createdAt_idx" ON "facility_code_audits"("action", "createdAt");

-- CreateIndex
CREATE INDEX "child_access_grants_userId_expiresAt_idx" ON "child_access_grants"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "child_access_grants_childId_userId_key" ON "child_access_grants"("childId", "userId");

-- CreateIndex
CREATE INDEX "child_access_audits_childId_createdAt_idx" ON "child_access_audits"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "child_access_audits_actorId_createdAt_idx" ON "child_access_audits"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "child_access_audits_action_createdAt_idx" ON "child_access_audits"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "facility_registration_codes" ADD CONSTRAINT "facility_registration_codes_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_registration_codes" ADD CONSTRAINT "facility_registration_codes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_registration_codes" ADD CONSTRAINT "facility_registration_codes_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_code_audits" ADD CONSTRAINT "facility_code_audits_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_code_audits" ADD CONSTRAINT "facility_code_audits_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "facility_registration_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_code_audits" ADD CONSTRAINT "facility_code_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_access_grants" ADD CONSTRAINT "child_access_grants_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_access_grants" ADD CONSTRAINT "child_access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_access_grants" ADD CONSTRAINT "child_access_grants_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_access_audits" ADD CONSTRAINT "child_access_audits_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_access_audits" ADD CONSTRAINT "child_access_audits_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_access_audits" ADD CONSTRAINT "child_access_audits_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
