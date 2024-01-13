/*
  Warnings:

  - A unique constraint covering the columns `[cardId]` on the table `Person` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Person_cardId_key` ON `Person`(`cardId`);
