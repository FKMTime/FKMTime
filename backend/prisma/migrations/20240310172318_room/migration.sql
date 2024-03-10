/*
  Warnings:

  - Added the required column `roomId` to the `Station` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Station" ADD COLUMN     "roomId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
