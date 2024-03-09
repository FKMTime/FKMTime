-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DELEGATE', 'STAFF');

-- CreateEnum
CREATE TYPE "Activity" AS ENUM ('COMPETITOR', 'JUDGE', 'RUNNER', 'SCRAMBLER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "notificationToken" TEXT,
    "role" "Role",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "registrantId" INTEGER,
    "name" TEXT NOT NULL,
    "wcaId" TEXT,
    "countryIso2" TEXT,
    "gender" TEXT NOT NULL,
    "canCompete" BOOLEAN NOT NULL DEFAULT true,
    "birthdate" TIMESTAMP(3),
    "giftpackCollectedAt" TIMESTAMP(3),
    "cardId" TEXT,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "wcaId" TEXT NOT NULL,
    "usesWcaProduction" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "countryIso2" TEXT,
    "currentGroupId" TEXT,
    "shouldCheckGroup" BOOLEAN NOT NULL DEFAULT false,
    "shouldUpdateDevices" BOOLEAN NOT NULL DEFAULT false,
    "useStableReleases" BOOLEAN NOT NULL DEFAULT true,
    "wcif" JSONB,
    "scoretakingToken" TEXT,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" SERIAL NOT NULL,
    "personId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "resultId" INTEGER,
    "attemptNumber" INTEGER NOT NULL,
    "replacedBy" INTEGER,
    "comment" TEXT,
    "isDelegate" BOOLEAN NOT NULL DEFAULT false,
    "extraGiven" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN DEFAULT false,
    "penalty" INTEGER,
    "isExtraAttempt" BOOLEAN NOT NULL DEFAULT false,
    "value" INTEGER NOT NULL,
    "judgeId" TEXT,
    "stationId" TEXT,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Station" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "espId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Person_cardId_key" ON "Person"("cardId");

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
