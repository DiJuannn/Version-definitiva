-- CreateEnum
CREATE TYPE "EditCutStatus" AS ENUM ('DRAFT', 'REVIEW', 'FINAL');

-- CreateEnum
CREATE TYPE "FestivalSubmissionStatus" AS ENUM ('PLANNED', 'SUBMITTED', 'IN_REVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "EditCut" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationLabel" TEXT,
    "date" TIMESTAMP(3),
    "status" "EditCutStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditCut_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FestivalSubmission" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "festivalName" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "fee" DECIMAL(65,30),
    "status" "FestivalSubmissionStatus" NOT NULL DEFAULT 'PLANNED',
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditCut_projectId_idx" ON "EditCut"("projectId");

-- CreateIndex
CREATE INDEX "FestivalSubmission_projectId_idx" ON "FestivalSubmission"("projectId");

-- AddForeignKey
ALTER TABLE "EditCut" ADD CONSTRAINT "EditCut_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivalSubmission" ADD CONSTRAINT "FestivalSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
