-- CreateEnum
CREATE TYPE "ScriptAnalysisStatus" AS ENUM ('PENDING', 'REVIEWED');

-- CreateTable
CREATE TABLE "ScriptAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptFileId" TEXT,
    "status" "ScriptAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "proposedData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ScriptAnalysis_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ScriptAnalysis" ADD CONSTRAINT "ScriptAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptAnalysis" ADD CONSTRAINT "ScriptAnalysis_scriptFileId_fkey" FOREIGN KEY ("scriptFileId") REFERENCES "ScriptFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
