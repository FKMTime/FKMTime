/*
  Warnings:

  - You are about to drop the column `currentGroupId` on the `Competition` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Competition" DROP COLUMN "currentGroupId";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "currentRoundId" TEXT;
