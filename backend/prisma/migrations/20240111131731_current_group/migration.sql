/*
  Warnings:

  - You are about to drop the column `currentRoundId` on the `Competition` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Competition` DROP FOREIGN KEY `Competition_currentRoundId_fkey`;

-- AlterTable
ALTER TABLE `Competition` DROP COLUMN `currentRoundId`,
    ADD COLUMN `currentGroupId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Competition` ADD CONSTRAINT `Competition_currentGroupId_fkey` FOREIGN KEY (`currentGroupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
