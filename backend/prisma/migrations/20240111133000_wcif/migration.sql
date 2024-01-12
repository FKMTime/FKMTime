/*
  Warnings:

  - You are about to drop the `Assigment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CompetitionEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Round` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `eventId` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `Result` table without a default value. This is not possible if the table is not empty.
  - Made the column `roundId` on table `Result` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Assigment` DROP FOREIGN KEY `Assigment_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `Assigment` DROP FOREIGN KEY `Assigment_personId_fkey`;

-- DropForeignKey
ALTER TABLE `Competition` DROP FOREIGN KEY `Competition_currentGroupId_fkey`;

-- DropForeignKey
ALTER TABLE `Group` DROP FOREIGN KEY `Group_roundId_fkey`;

-- DropForeignKey
ALTER TABLE `Result` DROP FOREIGN KEY `Result_roundId_fkey`;

-- DropForeignKey
ALTER TABLE `Round` DROP FOREIGN KEY `Round_competitionEventId_fkey`;

-- AlterTable
ALTER TABLE `Attempt` ADD COLUMN `stationId` INTEGER NULL;

-- AlterTable
ALTER TABLE `Competition` ADD COLUMN `wcif` JSON NULL,
    MODIFY `currentGroupId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Result` ADD COLUMN `eventId` VARCHAR(191) NOT NULL,
    ADD COLUMN `groupId` VARCHAR(191) NOT NULL,
    MODIFY `roundId` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `Assigment`;

-- DropTable
DROP TABLE `CompetitionEvent`;

-- DropTable
DROP TABLE `Group`;

-- DropTable
DROP TABLE `Round`;

-- AddForeignKey
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_stationId_fkey` FOREIGN KEY (`stationId`) REFERENCES `Station`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
