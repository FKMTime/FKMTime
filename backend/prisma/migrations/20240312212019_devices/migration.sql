/*
  Warnings:

  - You are about to drop the column `stationId` on the `Attempt` table. All the data in the column will be lost.
  - You are about to drop the `Station` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('STATION', 'ATTENDANCE');

-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_stationId_fkey";

-- DropForeignKey
ALTER TABLE "Station" DROP CONSTRAINT "Station_roomId_fkey";

-- AlterTable
ALTER TABLE "Attempt" DROP COLUMN "stationId",
ADD COLUMN     "deviceId" TEXT;

-- DropTable
DROP TABLE "Station";

-- DropEnum
DROP TYPE "Activity";

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "espId" TEXT,
    "type" "DeviceType" NOT NULL,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
