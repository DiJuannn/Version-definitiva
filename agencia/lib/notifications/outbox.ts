import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const MAX_ATTEMPTS = 5;

/**
 * Procesa la bandeja de salida. Cada email se "reclama" con un UPDATE
 * condicional antes de enviarse, así dos procesos concurrentes nunca envían el
 * mismo. El proveedor recibe además la idempotencyKey.
 */
export async function processOutbox(limit = 20) {
  const e = env();
  const due = await db.emailOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const result = { sent: 0, failed: 0, skipped: 0, retried: 0 };
  for (const item of due) {
    const claimed = await db.emailOutbox.updateMany({
      where: { id: item.id, status: "PENDING", attempts: item.attempts },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 5 * 60_000) },
    });
    if (claimed.count === 0) continue;

    if (!e.RESEND_API_KEY || !e.EMAIL_FROM) {
      await db.emailOutbox.update({
        where: { id: item.id },
        data: { status: "SKIPPED", lastError: "No hay proveedor de email configurado (RESEND_API_KEY / EMAIL_FROM)." },
      });
      result.skipped++;
      continue;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${e.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": item.idempotencyKey.slice(0, 256),
        },
        body: JSON.stringify({ from: e.EMAIL_FROM, to: [item.to], subject: item.subject, text: item.body }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      await db.emailOutbox.update({ where: { id: item.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      result.sent++;
    } catch (err) {
      const attempts = item.attempts + 1;
      const final = attempts >= MAX_ATTEMPTS;
      await db.emailOutbox.update({
        where: { id: item.id },
        data: {
          status: final ? "FAILED" : "PENDING",
          lastError: String(err instanceof Error ? err.message : err).slice(0, 500),
          nextAttemptAt: new Date(Date.now() + 2 ** attempts * 60_000),
        },
      });
      if (final) result.failed++;
      else result.retried++;
    }
  }
  return result;
}
