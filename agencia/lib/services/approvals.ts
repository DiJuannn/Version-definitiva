import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdmin, isManager, type Actor } from "@/lib/authz/actor";
import { loadVersion } from "@/lib/authz/guards";
import { canTransitionPiece } from "@/lib/domain/piece-status";
import { isDecidable } from "@/lib/domain/version-status";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/errors";
import { notify } from "@/lib/notifications/notify";
import { audit } from "./audit";
import { transitionPiece } from "./pieces";

export const decisionInput = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]),
  note: z.string().trim().max(2000).optional().default(""),
  acknowledgeOpen: z.boolean().optional().default(false),
});

export function canDecide(a: Actor, clientId: string): boolean {
  if (a.kind === "guest") return a.link.canApprove;
  if (a.role === "CLIENT") return a.clientId === clientId;
  // Gestión puede registrar una decisión recibida por otro canal (email, llamada) con nota obligatoria.
  return a.role === "ADMIN" || a.role === "COORDINATOR";
}

/**
 * Aprobación o solicitud de cambios sobre UNA versión concreta.
 * - Acción explícita, append-only, con autor y fecha.
 * - Política de la organización frente a correcciones abiertas.
 * - Al aprobar, la versión queda bloqueada (lockedAt).
 */
export async function decideVersion(a: Actor, versionId: string, raw: unknown) {
  const input = decisionInput.parse(raw);
  const v = await loadVersion(a, versionId);
  const piece = v.piece;
  if (!canDecide(a, piece.project.clientId)) throw forbidden("No tienes permiso para aprobar o pedir cambios");
  if (!v.publishedAt) throw badRequest("Solo se decide sobre versiones publicadas al cliente");
  if (!isDecidable(v.status)) throw badRequest("Esta versión ya no admite decisión");
  if (a.kind === "user" && isManager(a) && !input.note) {
    throw badRequest("Indica por qué canal llegó la decisión del cliente (nota obligatoria)");
  }
  if (input.decision === "CHANGES_REQUESTED" && v.status === "CHANGES_REQUESTED") {
    throw badRequest("Ya se pidieron cambios en esta versión");
  }

  const org = await db.organization.findUniqueOrThrow({ where: { id: a.organizationId } });
  const open = await db.correction.count({
    where: { pieceId: piece.id, status: { in: ["PENDING", "IN_PROGRESS"] }, comment: { deletedAt: null, visibility: "CLIENT" } },
  });
  if (input.decision === "APPROVED" && open > 0) {
    if (org.approvalPolicy === "BLOCK_IF_OPEN") {
      throw conflict(`Hay ${open} correcciones abiertas. Deben resolverse o descartarse antes de aprobar.`);
    }
    if (!input.acknowledgeOpen) {
      throw conflict(`Hay ${open} correcciones abiertas. Confirma que apruebas igualmente.`);
    }
  }

  return db.$transaction(async (tx) => {
    const to = input.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED";
    const res = await tx.version.updateMany({
      where: { id: versionId, status: { in: ["CLIENT_REVIEW", "CHANGES_REQUESTED"] } },
      data: { status: to, ...(to === "APPROVED" ? { lockedAt: new Date() } : {}) },
    });
    if (res.count === 0) throw conflict("Otra persona acaba de decidir sobre esta versión. Recarga la página.");
    const approval = await tx.approval.create({
      data: {
        versionId,
        decision: input.decision,
        actorUserId: a.kind === "user" ? a.id : null,
        actorGuestId: a.kind === "guest" ? a.id : null,
        actorName: a.name,
        actorEmail: a.email,
        note: input.note || null,
        openCorrections: open,
        acknowledgedOpen: input.acknowledgeOpen && open > 0,
      },
    });
    const state = { id: piece.id, status: piece.status, projectId: piece.projectId };
    if (to === "APPROVED") {
      await tx.piece.update({ where: { id: piece.id }, data: { approvedVersionId: versionId } });
      // Si ya hay una versión posterior en marcha, la pieza conserva su estado operativo.
      if (canTransitionPiece(piece.status, "APPROVED", "SYSTEM")) await transitionPiece(tx, state, "APPROVED", a, { system: true });
    } else if (piece.status === "CLIENT_REVIEW") {
      await transitionPiece(tx, state, "CHANGES_REQUESTED", a, { system: true });
    }
    await audit(tx, a, {
      action: to === "APPROVED" ? "version.approve" : "version.request_changes",
      entityType: "Version",
      entityId: versionId,
      projectId: piece.projectId,
      clientVisible: true,
      data: { number: v.number, openCorrections: open, note: input.note || null },
    });
    if (a.kind === "guest") {
      await tx.shareLinkEvent.create({ data: { shareLinkId: a.link.id, guestId: a.id, type: to === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED" } });
    }
    await notify(tx, {
      organizationId: a.organizationId,
      type: to === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED",
      recipients: [piece.editorId, piece.project.coordinatorId].filter(Boolean) as string[],
      title: to === "APPROVED" ? `«${piece.title}» V${v.number} aprobada` : `Cambios solicitados en «${piece.title}» V${v.number}`,
      body: input.note || undefined,
      url: `/revision/${versionId}`,
      groupKey: `decision:${versionId}`,
      eventKey: `approval:${approval.id}`,
      internal: true,
      excludeUserId: a.kind === "user" ? a.id : null,
    });
    return approval;
  });
}

/** Revocar una aprobación: solo administración, con motivo; queda en el historial. */
export async function revokeApproval(a: Actor, approvalId: string, reason: string) {
  if (!isAdmin(a)) throw forbidden("Solo administración puede revocar una aprobación");
  const text = z.string().trim().min(5, "Explica el motivo").max(1000).parse(reason);
  const ap = await db.approval.findUnique({ where: { id: approvalId } });
  if (!ap || ap.decision !== "APPROVED" || ap.revokedAt) throw notFound("Aprobación");
  const v = await loadVersion(a, ap.versionId);
  await db.$transaction(async (tx) => {
    await tx.approval.update({ where: { id: approvalId }, data: { revokedAt: new Date(), revokedById: a.id, revokeReason: text } });
    await tx.version.update({ where: { id: v.id }, data: { status: "CLIENT_REVIEW", lockedAt: null } });
    if (v.piece.approvedVersionId === v.id) {
      const prev = await tx.approval.findFirst({
        where: { version: { pieceId: v.pieceId }, decision: "APPROVED", revokedAt: null, id: { not: approvalId } },
        orderBy: { createdAt: "desc" },
      });
      await tx.piece.update({ where: { id: v.pieceId }, data: { approvedVersionId: prev?.versionId ?? null } });
    }
    if (v.piece.status === "APPROVED") {
      await transitionPiece(tx, { id: v.pieceId, status: v.piece.status, projectId: v.piece.projectId }, "CLIENT_REVIEW", a, { note: text });
    }
    await audit(tx, a, {
      action: "approval.revoke",
      entityType: "Approval",
      entityId: approvalId,
      projectId: v.piece.projectId,
      clientVisible: true,
      data: { reason: text, versionId: v.id },
    });
  });
}
