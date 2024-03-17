/*
  Warnings:

  - A unique constraint covering the columns `[espId]` on the table `Device` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Device_espId_key" ON "Device"("espId");
