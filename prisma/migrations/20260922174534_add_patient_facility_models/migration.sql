-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('PHC', 'CHC', 'HOSPITAL', 'CLINIC', 'OTHER');

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helper_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "helper_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "helper_facility_links" (
    "id" TEXT NOT NULL,
    "helperId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "helper_facility_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_staff_facility_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_staff_facility_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_helper_links" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "helperId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_helper_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_userId_key" ON "patients"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "helper_profiles_userId_key" ON "helper_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "helper_facility_links_helperId_facilityId_key" ON "helper_facility_links"("helperId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_staff_facility_links_userId_facilityId_key" ON "hospital_staff_facility_links"("userId", "facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "patient_helper_links_patientId_helperId_key" ON "patient_helper_links"("patientId", "helperId");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helper_profiles" ADD CONSTRAINT "helper_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helper_facility_links" ADD CONSTRAINT "helper_facility_links_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "helper_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "helper_facility_links" ADD CONSTRAINT "helper_facility_links_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_staff_facility_links" ADD CONSTRAINT "hospital_staff_facility_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_staff_facility_links" ADD CONSTRAINT "hospital_staff_facility_links_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_helper_links" ADD CONSTRAINT "patient_helper_links_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_helper_links" ADD CONSTRAINT "patient_helper_links_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "helper_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
