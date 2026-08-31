-- AlterTable
ALTER TABLE "ScriptAnalysis" ADD COLUMN     "createdById" TEXT;

-- CreateIndex
CREATE INDEX "ScriptAnalysis_createdById_idx" ON "ScriptAnalysis"("createdById");

-- AddForeignKey
ALTER TABLE "ScriptAnalysis" ADD CONSTRAINT "ScriptAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
