-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('STATION', 'ATTENDANCE_SCRAMBLER', 'ATTENDANCE_RUNNER');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('STANDARD_ATTEMPT', 'EXTRA_ATTEMPT', 'UNRESOLVED', 'RESOLVED', 'EXTRA_GIVEN');

-- CreateEnum
CREATE TYPE "ReleaseChannel" AS ENUM ('STABLE', 'PRE_RELEASE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DELEGATE', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('JUDGE', 'RUNNER', 'SCRAMBLER');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "username" TEXT,
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
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "deviceId" TEXT,
    "groupId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "wcaId" TEXT NOT NULL,
    "sendResultsToWcaLive" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "countryIso2" TEXT,
    "shouldUpdateDevices" BOOLEAN NOT NULL DEFAULT false,
    "releaseChannel" "ReleaseChannel" NOT NULL DEFAULT 'STABLE',
    "wcif" JSONB,
    "scoretakingToken" TEXT,
    "scoretakingTokenUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "currentGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "resultId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "replacedBy" INTEGER,
    "comment" TEXT,
    "status" "AttemptStatus" NOT NULL DEFAULT 'STANDARD_ATTEMPT',
    "penalty" INTEGER,
    "value" INTEGER NOT NULL,
    "inspectionTime" INTEGER,
    "judgeId" TEXT,
    "deviceId" TEXT,
    "solvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "espId" INTEGER,
    "type" "DeviceType" NOT NULL,
    "batteryPercentage" INTEGER,
    "roomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_username_key" ON "Account"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Person_registrantId_key" ON "Person"("registrantId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_cardId_key" ON "Person"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_personId_groupId_role_key" ON "Attendance"("personId", "groupId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Result_personId_roundId_key" ON "Result"("personId", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_espId_key" ON "Device"("espId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
