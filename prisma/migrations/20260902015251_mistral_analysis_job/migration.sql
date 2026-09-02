-- CreateTable
CREATE TABLE "MistralAnalysisJob" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MistralAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MistralAnalysisJob_finishedAt_startedAt_idx" ON "MistralAnalysisJob"("finishedAt", "startedAt");
