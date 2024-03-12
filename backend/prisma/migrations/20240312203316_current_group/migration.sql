/*
  Warnings:

  - You are about to drop the column `currentRoundId` on the `Room` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Room" DROP COLUMN "currentRoundId",
ADD COLUMN     "currentGroupId" TEXT;
