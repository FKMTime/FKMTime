-- DropIndex
DROP INDEX `Person_cardId_key` ON `Person`;

-- DropIndex
DROP INDEX `Station_espId_key` ON `Station`;

-- AlterTable
ALTER TABLE `Person` MODIFY `cardId` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `Station` MODIFY `espId` LONGTEXT NULL;
