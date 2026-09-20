-- CreateTable
CREATE TABLE "Moodboard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "cardCount" INTEGER NOT NULL DEFAULT 0,
    "aiDay" TEXT,
    "aiCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moodboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Moodboard_projectId_key" ON "Moodboard"("projectId");

-- AddForeignKey
ALTER TABLE "Moodboard" ADD CONSTRAINT "Moodboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
