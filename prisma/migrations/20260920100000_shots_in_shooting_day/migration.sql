-- AlterTable
ALTER TABLE "Shot" ADD COLUMN     "done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shootingDayId" TEXT;

-- CreateIndex
CREATE INDEX "Shot_shootingDayId_idx" ON "Shot"("shootingDayId");

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_shootingDayId_fkey" FOREIGN KEY ("shootingDayId") REFERENCES "ShootingDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
