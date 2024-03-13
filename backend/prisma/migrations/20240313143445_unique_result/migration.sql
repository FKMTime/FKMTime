/*
  Warnings:

  - A unique constraint covering the columns `[personId,roundId]` on the table `Result` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Result_personId_roundId_key" ON "Result"("personId", "roundId");
