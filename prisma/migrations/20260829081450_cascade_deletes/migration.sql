-- DropForeignKey
ALTER TABLE "BudgetItem" DROP CONSTRAINT "BudgetItem_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "CallSheet" DROP CONSTRAINT "CallSheet_shootingDayId_fkey";

-- DropForeignKey
ALTER TABLE "SceneBreakdownElement" DROP CONSTRAINT "SceneBreakdownElement_breakdownElementId_fkey";

-- DropForeignKey
ALTER TABLE "SceneBreakdownElement" DROP CONSTRAINT "SceneBreakdownElement_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "SceneCharacter" DROP CONSTRAINT "SceneCharacter_characterId_fkey";

-- DropForeignKey
ALTER TABLE "SceneCharacter" DROP CONSTRAINT "SceneCharacter_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "SceneCrewMember" DROP CONSTRAINT "SceneCrewMember_crewMemberId_fkey";

-- DropForeignKey
ALTER TABLE "SceneCrewMember" DROP CONSTRAINT "SceneCrewMember_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "ShootingDayScene" DROP CONSTRAINT "ShootingDayScene_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "ShootingDayScene" DROP CONSTRAINT "ShootingDayScene_shootingDayId_fkey";

-- DropForeignKey
ALTER TABLE "Shot" DROP CONSTRAINT "Shot_sceneId_fkey";

-- DropForeignKey
ALTER TABLE "StoryboardFrame" DROP CONSTRAINT "StoryboardFrame_shotId_fkey";

-- AddForeignKey
ALTER TABLE "SceneCharacter" ADD CONSTRAINT "SceneCharacter_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCharacter" ADD CONSTRAINT "SceneCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneBreakdownElement" ADD CONSTRAINT "SceneBreakdownElement_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneBreakdownElement" ADD CONSTRAINT "SceneBreakdownElement_breakdownElementId_fkey" FOREIGN KEY ("breakdownElementId") REFERENCES "BreakdownElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCrewMember" ADD CONSTRAINT "SceneCrewMember_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneCrewMember" ADD CONSTRAINT "SceneCrewMember_crewMemberId_fkey" FOREIGN KEY ("crewMemberId") REFERENCES "CrewMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootingDayScene" ADD CONSTRAINT "ShootingDayScene_shootingDayId_fkey" FOREIGN KEY ("shootingDayId") REFERENCES "ShootingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootingDayScene" ADD CONSTRAINT "ShootingDayScene_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSheet" ADD CONSTRAINT "CallSheet_shootingDayId_fkey" FOREIGN KEY ("shootingDayId") REFERENCES "ShootingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shot" ADD CONSTRAINT "Shot_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryboardFrame" ADD CONSTRAINT "StoryboardFrame_shotId_fkey" FOREIGN KEY ("shotId") REFERENCES "Shot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BudgetCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
