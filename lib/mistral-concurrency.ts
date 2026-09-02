import { prisma } from "@/lib/prisma";
import { MISTRAL_MAX_CONCURRENT_CALLS } from "@/lib/limits";

// Si una función se corta a medias (timeout, caída) sin llegar a marcar
// su hueco como terminado, deja de contar como "en marcha" pasado este
// tiempo — más que de sobra sobre el maxDuration de 60s de las páginas
// que llaman a Mistral, para que nunca se quede bloqueado para siempre.
const STALE_MS = 90 * 1000;
const POLL_INTERVAL_MS = 3000;
const MAX_WAIT_MS = 40 * 1000;

export class MistralBusyError extends Error {}

async function tryAcquireSlot(): Promise<string | null> {
  const activeCount = await prisma.mistralAnalysisJob.count({
    where: { finishedAt: null, startedAt: { gte: new Date(Date.now() - STALE_MS) } },
  });
  if (activeCount >= MISTRAL_MAX_CONCURRENT_CALLS) return null;

  const job = await prisma.mistralAnalysisJob.create({ data: {} });
  return job.id;
}

async function releaseSlot(jobId: string) {
  await prisma.mistralAnalysisJob
    .update({ where: { id: jobId }, data: { finishedAt: new Date() } })
    .catch(() => {});
}

// Espera un hueco libre (reintentando cada pocos segundos, hasta
// MAX_WAIT_MS) antes de ejecutar `fn` — así una llamada a Mistral que
// llega mientras ya hay MISTRAL_MAX_CONCURRENT_CALLS en marcha no falla
// directamente, sino que aguarda su turno un momento razonable. Si no
// se libera ningún hueco a tiempo, lanza MistralBusyError.
export async function withMistralSlot<T>(fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + MAX_WAIT_MS;
  let jobId: string | null = null;

  while (Date.now() < deadline) {
    jobId = await tryAcquireSlot();
    if (jobId) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  if (!jobId) throw new MistralBusyError();

  try {
    return await fn();
  } finally {
    await releaseSlot(jobId);
  }
}
