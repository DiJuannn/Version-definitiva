-- CreateEnum
CREATE TYPE "ScreenplayFormat" AS ENUM ('SHORT', 'FEATURE', 'SERIES_EPISODE', 'OTHER');

-- CreateTable
CREATE TABLE "Screenplay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "format" "ScreenplayFormat" NOT NULL DEFAULT 'SHORT',
    "logline" TEXT,
    "author" TEXT,
    "ydoc" BYTEA,
    "content" JSONB,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "sceneCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screenplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Screenplay_organizationId_updatedAt_idx" ON "Screenplay"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Screenplay_projectId_idx" ON "Screenplay"("projectId");

-- AddForeignKey
ALTER TABLE "Screenplay" ADD CONSTRAINT "Screenplay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenplay" ADD CONSTRAINT "Screenplay_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screenplay" ADD CONSTRAINT "Screenplay_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
