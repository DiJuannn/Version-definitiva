-- AlterTable
ALTER TABLE "ShootingDay" ADD COLUMN     "shareToken" TEXT;

-- CreateTable
CREATE TABLE "ProjectBackup" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "label" TEXT,
    "sceneCount" INTEGER NOT NULL DEFAULT 0,
    "shotCount" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectBackup_projectId_createdAt_idx" ON "ProjectBackup"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShootingDay_shareToken_key" ON "ShootingDay"("shareToken");

-- AddForeignKey
ALTER TABLE "ProjectBackup" ADD CONSTRAINT "ProjectBackup_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
