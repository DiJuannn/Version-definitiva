-- CreateEnum
CREATE TYPE "ContinuityCheckStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ContinuityIssueStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Scene" ADD COLUMN     "storyOrder" INTEGER;

-- AlterTable
ALTER TABLE "SceneBreakdownElement" ADD COLUMN     "condition" TEXT;

-- CreateTable
CREATE TABLE "ContinuityCheck" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "ContinuityCheckStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ContinuityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContinuityIssue" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sceneNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ContinuityIssueStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContinuityIssue_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ContinuityCheck" ADD CONSTRAINT "ContinuityCheck_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContinuityIssue" ADD CONSTRAINT "ContinuityIssue_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "ContinuityCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
