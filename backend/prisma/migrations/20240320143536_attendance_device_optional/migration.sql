-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_deviceId_fkey";

-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "deviceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
