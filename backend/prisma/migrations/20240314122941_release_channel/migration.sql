/*
  Warnings:

  - You are about to drop the column `useStableReleases` on the `Competition` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ReleaseChannel" AS ENUM ('STABLE', 'PRE_RELEASE');

-- AlterTable
ALTER TABLE "Competition" DROP COLUMN "useStableReleases",
ADD COLUMN     "releaseChannel" "ReleaseChannel" NOT NULL DEFAULT 'STABLE';
