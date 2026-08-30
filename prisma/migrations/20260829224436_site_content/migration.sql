-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "heroTitle" TEXT NOT NULL DEFAULT 'Historias que
se quedan.',
    "heroSubtitle" TEXT NOT NULL DEFAULT 'Versión definitiva — de la idea al montaje final.',
    "aboutQuestion" TEXT NOT NULL DEFAULT '¿Qué historia merece contarse?',
    "aboutText" TEXT NOT NULL DEFAULT 'Somos un equipo pequeño que trabaja como uno grande: desde el guion hasta la entrega final, cuidando cada decisión de imagen, ritmo y sonido.',
    "contactEmail" TEXT NOT NULL DEFAULT 'hola@versiondefinitiva.com',
    "marqueeTags" TEXT[] DEFAULT ARRAY['FICCIÓN', 'PUBLICIDAD', 'DOCUMENTAL', 'CORPORATIVO', 'COLOR', 'SONIDO', 'MONTAJE']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "siteContentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "siteContentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "videoUrl" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteContent_organizationId_key" ON "SiteContent"("organizationId");

-- AddForeignKey
ALTER TABLE "SiteContent" ADD CONSTRAINT "SiteContent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_siteContentId_fkey" FOREIGN KEY ("siteContentId") REFERENCES "SiteContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_siteContentId_fkey" FOREIGN KEY ("siteContentId") REFERENCES "SiteContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
