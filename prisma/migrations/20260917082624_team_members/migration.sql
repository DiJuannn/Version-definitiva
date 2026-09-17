-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "siteContentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "bio" TEXT,
    "photoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMember_siteContentId_idx" ON "TeamMember"("siteContentId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_siteContentId_fkey" FOREIGN KEY ("siteContentId") REFERENCES "SiteContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
