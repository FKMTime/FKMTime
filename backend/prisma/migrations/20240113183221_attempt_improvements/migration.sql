-- DropIndex
DROP INDEX `Competition_currentGroupId_fkey` ON `Competition`;

-- DropIndex
DROP INDEX `Result_roundId_fkey` ON `Result`;

-- AlterTable
ALTER TABLE `Attempt` ADD COLUMN `isDelegate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `penalty` INTEGER NULL,
    ADD COLUMN `replacedBy` INTEGER NULL;
