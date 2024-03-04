-- AlterTable
ALTER TABLE `Person` ADD COLUMN `canCompete` BOOLEAN NOT NULL DEFAULT true,
    MODIFY `registrantId` INTEGER NULL;
