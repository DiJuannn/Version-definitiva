import { prisma } from "@/lib/prisma";
import type { RateLimitStatus } from "@/lib/script-analysis-rate-limit";
export { formatWait } from "@/lib/script-analysis-rate-limit";

// Misma lógica que checkScriptAnalysisRateLimit (lib/script-analysis-rate-limit.ts)
// pero contra ShotListImport — son cuotas independientes de las del guion narrativo.
export async function checkShotListImportRateLimit(
  userId: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitStatus> {
  const recent = await prisma.shotListImport.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { createdAt: true },
  });
  if (recent.length < limit) return { blocked: false, retryAt: null };

  const oldest = recent[recent.length - 1].createdAt;
  const retryAt = new Date(oldest.getTime() + windowMs);
  if (retryAt <= new Date()) return { blocked: false, retryAt: null };

  return { blocked: true, retryAt };
}
