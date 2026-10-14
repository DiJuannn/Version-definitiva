-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "profile" JSONB,
ADD COLUMN     "screenplayId" TEXT;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_screenplayId_fkey" FOREIGN KEY ("screenplayId") REFERENCES "Screenplay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
