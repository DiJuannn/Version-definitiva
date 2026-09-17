-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" TEXT NOT NULL,
    "siteContentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "siteContentId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessStep_siteContentId_idx" ON "ProcessStep"("siteContentId");

-- CreateIndex
CREATE INDEX "FaqItem_siteContentId_idx" ON "FaqItem"("siteContentId");

-- AddForeignKey
ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_siteContentId_fkey" FOREIGN KEY ("siteContentId") REFERENCES "SiteContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaqItem" ADD CONSTRAINT "FaqItem_siteContentId_fkey" FOREIGN KEY ("siteContentId") REFERENCES "SiteContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
