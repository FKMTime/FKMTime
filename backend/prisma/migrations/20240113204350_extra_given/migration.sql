/*
  Warnings:

  - You are about to drop the column `isExtra` on the `Attempt` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Attempt` DROP COLUMN `isExtra`,
    ADD COLUMN `extraGiven` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isExtraAttempt` BOOLEAN NOT NULL DEFAULT false;
