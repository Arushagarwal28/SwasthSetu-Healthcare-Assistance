-- AlterTable
ALTER TABLE "assessments" ADD COLUMN     "predictedDisease" TEXT,
ADD COLUMN     "predictionConfidence" DOUBLE PRECISION,
ADD COLUMN     "predictionDetails" JSONB;
