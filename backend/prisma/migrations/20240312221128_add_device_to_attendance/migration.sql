/*
  Warnings:

  - Added the required column `deviceId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `role` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('JUDGE', 'RUNNER', 'SCRAMBLER');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "deviceId" TEXT NOT NULL,
ADD COLUMN     "role" "StaffRole" NOT NULL;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
