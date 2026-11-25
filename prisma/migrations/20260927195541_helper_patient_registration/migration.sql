-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "createdByHelperId" TEXT,
ADD COLUMN     "email" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_createdByHelperId_fkey" FOREIGN KEY ("createdByHelperId") REFERENCES "helper_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
