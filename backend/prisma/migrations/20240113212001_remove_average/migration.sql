/*
  Warnings:

  - You are about to drop the column `average` on the `Result` table. All the data in the column will be lost.
  - You are about to drop the column `best` on the `Result` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `Result` DROP COLUMN `average`,
    DROP COLUMN `best`;
