import { prisma } from "@/lib/prisma";

export type RateLimitStatus = { blocked: boolean; retryAt: Date | null };

// Comprueba si las últimas `limit` veces que este usuario lanzó un
// análisis de guion caben todas dentro de la ventana `windowMs` — si es
// así, la más antigua de ese grupo es la que marca cuándo se libera un
// hueco (retryAt), no un contador que se reinicia en un momento fijo.
export async function checkScriptAnalysisRateLimit(
  userId: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitStatus> {
  const recent = await prisma.scriptAnalysis.findMany({
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

// "23 minutos", "2 horas", "1 hora y 15 minutos" — para el aviso de
// cuándo se puede volver a intentar.
export function formatWait(retryAt: Date): string {
  const ms = retryAt.getTime() - Date.now();
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} minuto${minutes === 1 ? "" : "s"}`;
  if (minutes === 0) return `${hours} hora${hours === 1 ? "" : "s"}`;
  return `${hours} hora${hours === 1 ? "" : "s"} y ${minutes} minuto${minutes === 1 ? "" : "s"}`;
}
