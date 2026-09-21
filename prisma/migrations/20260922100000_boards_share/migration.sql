-- Varias pizarras por proyecto + enlace público de solo lectura.
-- DropIndex
DROP INDEX "ProjectMap_projectId_key";

-- AlterTable
ALTER TABLE "ProjectMap" ADD COLUMN     "name" TEXT NOT NULL DEFAULT 'Mapa del proyecto',
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMap_shareToken_key" ON "ProjectMap"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMap_projectId_sortOrder_key" ON "ProjectMap"("projectId", "sortOrder");
