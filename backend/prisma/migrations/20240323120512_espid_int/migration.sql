/*
  Warnings:

  - The `espId` column on the `Device` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Device" DROP COLUMN "espId",
ADD COLUMN     "espId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Device_espId_key" ON "Device"("espId");
