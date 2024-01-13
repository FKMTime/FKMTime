/*
  Warnings:

  - You are about to alter the column `cardId` on the `Person` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `BigInt`.
  - You are about to alter the column `espId` on the `Station` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `BigInt`.
  - A unique constraint covering the columns `[espId]` on the table `Station` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Person` MODIFY `cardId` BIGINT NULL;

-- AlterTable
ALTER TABLE `Station` MODIFY `espId` BIGINT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Station_espId_key` ON `Station`(`espId`);
