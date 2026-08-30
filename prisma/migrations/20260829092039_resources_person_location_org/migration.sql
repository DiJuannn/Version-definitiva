-- CreateEnum
CREATE TYPE "LocationCharacteristic" AS ENUM ('ELECTRICITY', 'PARKING', 'VEHICLE_ACCESS', 'BATHROOM', 'DRESSING_ROOM', 'CREW_SPACE', 'NOISE_CONTROL', 'EXTERIOR', 'INTERIOR');

-- CreateEnum
CREATE TYPE "PersonAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- AlterTable
ALTER TABLE "Actor" ADD COLUMN "personId" TEXT;

-- AlterTable
ALTER TABLE "CrewMember" ADD COLUMN "personId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "personId" TEXT;

-- AlterTable: Location pasa de projectId a organizationId (con backfill de datos existentes)
ALTER TABLE "Location" DROP CONSTRAINT "Location_projectId_fkey";

ALTER TABLE "Location"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "videoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "characteristics" "LocationCharacteristic"[] DEFAULT ARRAY[]::"LocationCharacteristic"[],
  ADD COLUMN "restrictions" TEXT;

UPDATE "Location" l
SET "organizationId" = p."organizationId"
FROM "Project" p
WHERE p."id" = l."projectId";

ALTER TABLE "Location" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Location" DROP COLUMN "projectId";

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "photoUrl" TEXT,
    "primaryRole" TEXT,
    "otherRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "rate" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonAvailability" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "PersonAvailabilityStatus" NOT NULL,
    "note" TEXT,

    CONSTRAINT "PersonAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonAvailability_personId_date_key" ON "PersonAvailability"("personId", "date");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAvailability" ADD CONSTRAINT "PersonAvailability_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
