import "server-only";
import { db } from "@/lib/db";
import { isInternal, isManager, isEditor, type Actor } from "@/lib/authz/actor";
import { loadPiece, loadVersion } from "@/lib/authz/guards";
import { aiProviderFor, aiUnavailable } from "@/lib/ai/provider";
import { forbidden, notFound } from "@/lib/http/errors";
import { formatClock } from "@/lib/domain/timecode";
import { audit } from "./audit";

async function providerFor(a: Actor) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: a.organizationId }, select: { aiEnabled: true } });
  const p = aiProviderFor(org);
  if (!p) throw aiUnavailable();
  return p;
}

export async function aiAvailable(organizationId: string) {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { aiEnabled: true } });
  return !!aiProviderFor(org);
}

/** Sugerencia de categoría (no se aplica sola). Solo equipo. */
export async function suggestCorrectionCategory(a: Actor, correctionId: string) {
  const c = await db.correction.findUnique({ where: { id: correctionId }, include: { comment: true } });
  if (!c) throw notFound("Corrección");
  const piece = await loadPiece(a, c.pieceId);
  if (!(isManager(a) || (isEditor(a) && piece.editorId === a.id))) throw forbidden();
  const p = await providerFor(a);
  const out = await p.suggestCategory(c.comment.body);
  await db.$transaction((tx) => audit(tx, a, { action: "ai.category", entityType: "Correction", entityId: c.id, projectId: piece.projectId, data: { provider: p.name } }));
  return out;
}

/** Resumen de la conversación de una versión para el equipo (incluye internos, que el actor ya puede ver). */
export async function summarizeVersion(a: Actor, versionId: string) {
  if (!isInternal(a)) throw forbidden();
  const v = await loadVersion(a, versionId);
  const comments = await db.comment.findMany({
    where: { versionId, deletedAt: null },
    orderBy: [{ timeMs: "asc" }, { createdAt: "asc" }],
    include: { authorUser: { select: { name: true } }, authorGuest: { select: { name: true } } },
  });
  if (!comments.length) return { summary: "No hay comentarios que resumir." };
  const text = comments
    .map((c) => `${c.parentId ? "  ↳ " : ""}[${c.timeMs == null ? "general" : formatClock(c.timeMs)}] ${c.authorUser?.name ?? c.authorGuest?.name ?? "?"}: ${c.body}`)
    .join("\n");
  const p = await providerFor(a);
  const summary = await p.summarize(text);
  await db.$transaction((tx) => audit(tx, a, { action: "ai.summary", entityType: "Version", entityId: versionId, projectId: v.piece.projectId, data: { provider: p.name } }));
  return { summary };
}
