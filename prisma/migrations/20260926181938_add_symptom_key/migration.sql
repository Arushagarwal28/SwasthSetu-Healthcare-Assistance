/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `symptoms` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "symptoms_name_key";

-- AlterTable
ALTER TABLE "symptoms" ADD COLUMN     "key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_key_key" ON "symptoms"("key");
