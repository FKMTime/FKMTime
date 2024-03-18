/*
  Warnings:

  - A unique constraint covering the columns `[personId,groupId,role]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Attendance_personId_groupId_role_key" ON "Attendance"("personId", "groupId", "role");
