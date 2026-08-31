-- CreateTable
CREATE TABLE "ClapLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sceneId" TEXT,
    "sceneNumber" TEXT NOT NULL,
    "take" INTEGER NOT NULL,
    "roll" TEXT,
    "camera" TEXT,
    "intExt" "IntExt",
    "dayPart" "DayPart",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClapLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClapLog_projectId_idx" ON "ClapLog"("projectId");

-- CreateIndex
CREATE INDEX "ClapLog_sceneId_idx" ON "ClapLog"("sceneId");

-- AddForeignKey
ALTER TABLE "ClapLog" ADD CONSTRAINT "ClapLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClapLog" ADD CONSTRAINT "ClapLog_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;
