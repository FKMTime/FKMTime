/*
  Warnings:

  - A unique constraint covering the columns `[registrantId]` on the table `Person` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Person_registrantId_key" ON "Person"("registrantId");
