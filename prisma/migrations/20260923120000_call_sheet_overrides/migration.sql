-- AlterTable
ALTER TABLE "CallSheet" ADD COLUMN "crewOverridden" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ShootingDaySceneCastOverride" (
    "shootingDayId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,

    CONSTRAINT "ShootingDaySceneCastOverride_pkey" PRIMARY KEY ("shootingDayId","sceneId")
);

-- CreateIndex
CREATE INDEX "ShootingDaySceneCastOverride_sceneId_idx" ON "ShootingDaySceneCastOverride"("sceneId");

-- AddForeignKey
ALTER TABLE "ShootingDaySceneCastOverride" ADD CONSTRAINT "ShootingDaySceneCastOverride_shootingDayId_fkey" FOREIGN KEY ("shootingDayId") REFERENCES "ShootingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootingDaySceneCastOverride" ADD CONSTRAINT "ShootingDaySceneCastOverride_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ShootingDaySceneCharacter" (
    "shootingDayId" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,

    CONSTRAINT "ShootingDaySceneCharacter_pkey" PRIMARY KEY ("shootingDayId","sceneId","characterId")
);

-- CreateIndex
CREATE INDEX "ShootingDaySceneCharacter_characterId_idx" ON "ShootingDaySceneCharacter"("characterId");

-- AddForeignKey
ALTER TABLE "ShootingDaySceneCharacter" ADD CONSTRAINT "ShootingDaySceneCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CallSheetCrewMember" (
    "callSheetId" TEXT NOT NULL,
    "crewMemberId" TEXT NOT NULL,

    CONSTRAINT "CallSheetCrewMember_pkey" PRIMARY KEY ("callSheetId","crewMemberId")
);

-- CreateIndex
CREATE INDEX "CallSheetCrewMember_crewMemberId_idx" ON "CallSheetCrewMember"("crewMemberId");

-- AddForeignKey
ALTER TABLE "CallSheetCrewMember" ADD CONSTRAINT "CallSheetCrewMember_callSheetId_fkey" FOREIGN KEY ("callSheetId") REFERENCES "CallSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheetCrewMember" ADD CONSTRAINT "CallSheetCrewMember_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
