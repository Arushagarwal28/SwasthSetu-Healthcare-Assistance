-- AlterTable
ALTER TABLE "follow_up_answers" ADD COLUMN     "symptomId" TEXT;

-- AddForeignKey
ALTER TABLE "follow_up_answers" ADD CONSTRAINT "follow_up_answers_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "symptoms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
