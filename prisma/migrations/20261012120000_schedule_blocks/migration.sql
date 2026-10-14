-- Orden de rodaje por planos: bloques de cada jornada (todo aditivo).

-- CreateEnum
CREATE TYPE "ScheduleBlockKind" AS ENUM ('SHOTS', 'SCENE', 'MEAL', 'MOVE', 'NOTE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "workdayHours" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "ShootingDay" ADD COLUMN "callTime" TEXT,
ADD COLUMN "prepMin" INTEGER,
ADD COLUMN "planUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ScheduleBlock" (
    "id" TEXT NOT NULL,
    "shootingDayId" TEXT NOT NULL,
    "kind" "ScheduleBlockKind" NOT NULL DEFAULT 'SHOTS',
    "order" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "sceneId" TEXT,
    "durationMin" INTEGER,
    "startTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBlock_shootingDayId_idx" ON "ScheduleBlock"("shootingDayId");

-- CreateIndex
CREATE INDEX "ScheduleBlock_sceneId_idx" ON "ScheduleBlock"("sceneId");

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_shootingDayId_fkey" FOREIGN KEY ("shootingDayId") REFERENCES "ShootingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Shot" ADD COLUMN "blockId" TEXT,
ADD COLUMN "blockOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "estimatedMin" INTEGER,
ADD COLUMN "retake" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "retakeNote" TEXT;

-- CreateIndex
CREATE INDEX "Shot_blockId_idx" ON "Shot"("blockId");

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ScheduleBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
