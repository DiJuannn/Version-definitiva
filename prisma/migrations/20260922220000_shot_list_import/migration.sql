-- CreateEnum
CREATE TYPE "ShotListImportStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateTable
CREATE TABLE "ShotListImport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ShotListImportStatus" NOT NULL DEFAULT 'PENDING',
    "proposedData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ShotListImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShotListImport_projectId_idx" ON "ShotListImport"("projectId");

-- CreateIndex
CREATE INDEX "ShotListImport_createdById_idx" ON "ShotListImport"("createdById");

-- AddForeignKey
ALTER TABLE "ShotListImport" ADD CONSTRAINT "ShotListImport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotListImport" ADD CONSTRAINT "ShotListImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
