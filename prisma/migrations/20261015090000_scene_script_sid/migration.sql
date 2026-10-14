-- AlterTable
ALTER TABLE "Scene" ADD COLUMN "scriptSid" TEXT;

-- CreateIndex
CREATE INDEX "Scene_projectId_scriptSid_idx" ON "Scene"("projectId", "scriptSid");
