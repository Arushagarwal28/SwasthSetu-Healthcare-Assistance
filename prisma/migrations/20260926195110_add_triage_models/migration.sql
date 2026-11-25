-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "disease_info" (
    "id" TEXT NOT NULL,
    "diseaseName" TEXT NOT NULL,
    "urgency" "UrgencyLevel" NOT NULL,
    "requiredSpecialty" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "disease_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_specialties" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disease_info_diseaseName_key" ON "disease_info"("diseaseName");

-- CreateIndex
CREATE UNIQUE INDEX "facility_specialties_facilityId_specialty_key" ON "facility_specialties"("facilityId", "specialty");

-- AddForeignKey
ALTER TABLE "facility_specialties" ADD CONSTRAINT "facility_specialties_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
