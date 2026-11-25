/*
  Warnings:

  - Made the column `key` on table `symptoms` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "symptoms" ALTER COLUMN "key" SET NOT NULL;
