/*
  Warnings:

  - You are about to drop the column `usesWcaProduction` on the `Competition` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Competition" DROP COLUMN "usesWcaProduction",
ADD COLUMN     "sendResultsToWcaLive" BOOLEAN NOT NULL DEFAULT true;
