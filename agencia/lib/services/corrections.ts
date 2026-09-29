import "server-only";
import { z } from "zod";
import type { CorrectionCategory, CorrectionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isEditor, isInternal, isManager, type Actor } from "@/lib/authz/actor";
import { loadPiece } from "@/lib/authz/guards";
import { canTransitionCorrection, type CorrectionActorKind } from "@/lib/domain/correction-status";
import { CORRECTION_STATUS } from "@/lib/domain/labels";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { notify } from "@/lib/notifications/notify";
import { audit } from "./audit";

export const correctionUpdate = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "RESOLVED", "VERIFIED", "DISMISSED"]).optional(),
  category: z.enum(["VIDEO", "AUDIO", "COLOR", "SUBTITLES", "MOTION_GRAPHICS", "BRANDING", "OTHER"]).optional(),
  assigneeId: z.string().nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

/** ¿Actúa como equipo (hace el trabajo) o como revisor (pidió la corrección)? */
function actorKindFor(a: Actor, piece: { editorId: string | null }): CorrectionActorKind | null {
  if (isManager(a)) return "team";
  if (isEditor(a)) return piece.editorId === a.id ? "team" : null;
  if (a.kind === "guest") return a.link.canComment ? "reviewer" : null;
  if (a.role === "CLIENT") return "reviewer";
  return null;
}

export async function updateCorrection(a: Actor, correctionId: string, raw: unknown) {
  const input = correctionUpdate.parse(raw);
  const corr = await db.correction.findUnique({ where: { id: correctionId }, include: { comment: true } });
  if (!corr) throw notFound("Corrección");
  const piece = await loadPiece(a, corr.pieceId);
  // Correcciones nacidas de comentarios internos no existen para el cliente.
  if (corr.comment.visibility === "INTERNAL" && !isInternal(a)) throw notFound("Corrección");
  const kind = actorKindFor(a, piece);
  if (!kind) throw forbidden();

  if ((input.category || input.assigneeId !== undefined) && kind !== "team") {
    throw forbidden("Solo el equipo puede cambiar la categoría o el responsable");
  }
  if (input.assigneeId) {
    const u = await db.user.findFirst({ where: { id: input.assigneeId, organizationId: a.organizationId, role: { not: "CLIENT" } } });
    if (!u) throw badRequest("Responsable no válido");
  }
  let to: CorrectionStatus | undefined;
  if (input.status && input.status !== corr.status) {
    if (!canTransitionCorrection(corr.status, input.status, kind)) {
      throw badRequest(`No puedes pasar de «${CORRECTION_STATUS[corr.status].label}» a «${CORRECTION_STATUS[input.status].label}»`);
    }
    to = input.status;
  }

  return db.$transaction(async (tx) => {
    const res = await tx.correction.updateMany({
      where: { id: correctionId, status: corr.status },
      data: {
        status: to,
        category: input.category as CorrectionCategory | undefined,
        assigneeId: input.assigneeId === undefined ? undefined : input.assigneeId,
      },
    });
    if (res.count === 0) throw badRequest("La corrección cambió mientras tanto. Recarga e inténtalo de nuevo.");
    if (to) {
      await tx.correctionEvent.create({
        data: {
          correctionId,
          fromStatus: corr.status,
          toStatus: to,
          actorUserId: a.kind === "user" ? a.id : null,
          actorGuestId: a.kind === "guest" ? a.id : null,
          note: input.note,
        },
      });
      const url = `/revision/${corr.comment.versionId}?c=${corr.commentId}`;
      if (to === "RESOLVED" && corr.comment.authorUserId) {
        await notify(tx, {
          organizationId: a.organizationId,
          type: "CORRECTION_RESOLVED",
          recipients: [corr.comment.authorUserId],
          title: `Corrección resuelta en «${piece.title}»`,
          body: corr.comment.body.slice(0, 160),
          url,
          groupKey: `resolved:${piece.id}`,
          eventKey: `correction:${correctionId}:${Date.now()}`,
          internal: corr.comment.visibility === "INTERNAL",
          excludeUserId: a.kind === "user" ? a.id : null,
        });
      }
      if (to === "PENDING" && (corr.status === "RESOLVED" || corr.status === "VERIFIED")) {
        await notify(tx, {
          organizationId: a.organizationId,
          type: "CORRECTION_REOPENED",
          recipients: [corr.assigneeId, piece.editorId].filter(Boolean) as string[],
          title: `Corrección reabierta en «${piece.title}»`,
          body: input.note ?? corr.comment.body.slice(0, 160),
          url,
          groupKey: `reopened:${piece.id}`,
          eventKey: `correction:${correctionId}:reopen:${Date.now()}`,
          internal: true,
          excludeUserId: a.kind === "user" ? a.id : null,
        });
      }
    }
    await audit(tx, a, {
      action: "correction.update",
      entityType: "Correction",
      entityId: correctionId,
      projectId: piece.projectId,
      data: { from: corr.status, to: to ?? null, category: input.category ?? null, assigneeId: input.assigneeId ?? null },
    });
  });
}

/** Correcciones abiertas de una pieza (todas sus versiones), visibles para el actor. */
export async function openCorrectionsForPiece(a: Actor, pieceId: string) {
  await loadPiece(a, pieceId);
  return db.correction.findMany({
    where: {
      pieceId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
      comment: { deletedAt: null, ...(isInternal(a) ? {} : { visibility: "CLIENT" }) },
    },
    include: { comment: { select: { body: true, timeMs: true, endMs: true, visibility: true } }, originVersion: { select: { number: true } } },
    orderBy: [{ originVersion: { number: "asc" } }, { createdAt: "asc" }],
  });
}
