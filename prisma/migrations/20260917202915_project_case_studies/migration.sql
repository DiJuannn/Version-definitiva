-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "credits" JSONB,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "heroImageUrl" TEXT,
ADD COLUMN     "logline" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "synopsis" TEXT,
ADD COLUMN     "tallerNote" TEXT,
ADD COLUMN     "usesTaller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "year" INTEGER;

-- CreateTable
CREATE TABLE "ProjectImage" (
    "id" TEXT NOT NULL,
    "portfolioItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectImage_portfolioItemId_idx" ON "ProjectImage"("portfolioItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioItem_slug_key" ON "PortfolioItem"("slug");

-- AddForeignKey
ALTER TABLE "ProjectImage" ADD CONSTRAINT "ProjectImage_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

