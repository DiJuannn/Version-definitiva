-- CreateTable
CREATE TABLE "ShotCharacter" (
    "shotId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "ShotCharacter_pkey" PRIMARY KEY ("shotId","characterId")
);

-- CreateIndex
CREATE INDEX "ShotCharacter_characterId_idx" ON "ShotCharacter"("characterId");

-- AddForeignKey
ALTER TABLE "ShotCharacter" ADD CONSTRAINT "ShotCharacter_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShotCharacter" ADD CONSTRAINT "ShotCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cada plano ya existente arranca con el reparto de su escena
-- (igual que el comportamiento anterior a este cambio), editable después
-- desde el detalle del plano.
INSERT INTO "ShotCharacter" ("shotId", "characterId")
SELECT s."id", sc."characterId"
FROM "Shot" s
JOIN "SceneCharacter" sc ON sc."sceneId" = s."sceneId";
