import "server-only";
import { z } from "zod";
import type { BlockerKind, PieceStatus, Priority } from "@prisma/client";
import { db, type Tx } from "@/lib/db";
import { isEditor, isManager, type Actor, type UserActor } from "@/lib/authz/actor";
import { loadPiece, requireProjectManager } from "@/lib/authz/guards";
import { canTransitionPiece } from "@/lib/domain/piece-status";
import { PIECE_STATUS } from "@/lib/domain/labels";
import { badRequest, forbidden } from "@/lib/http/errors";
import { notify } from "@/lib/notifications/notify";
import { audit } from "./audit";

export const pieceInput = z.object({
  title: z.string().trim().min(2, "El título es demasiado corto").max(140),
  description: z.string().trim().max(4000).optional().default(""),
  format: z.string().trim().max(60).optional().default(""),
  aspectRatio: z.string().trim().max(20).optional().default(""),
  resolution: z.string().trim().max(40).optional().default(""),
  targetDurationSec: z.coerce.number().int().min(0).max(36000).optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

/**
 * Cambia el estado de una pieza validando la máquina de estados y deja rastro.
 * `role` "SYSTEM" para transiciones automáticas derivadas de otra acción.
 */
export async function transitionPiece(
  tx: Tx,
  piece: { id: string; status: PieceStatus; projectId: string },
  to: PieceStatus,
  actor: Actor,
  opts: { system?: boolean; note?: string } = {},
) {
  if (piece.status === to) return;
  const role = opts.system ? "SYSTEM" : actor.kind === "guest" ? "CLIENT" : actor.role;
  if (!canTransitionPiece(piece.status, to, role)) {
    throw badRequest(`No se puede pasar de «${PIECE_STATUS[piece.status].label}» a «${PIECE_STATUS[to].label}»`);
  }
  // Actualización condicional: si otro proceso cambió el estado a la vez, falla en vez de pisarlo.
  const res = await tx.piece.updateMany({ where: { id: piece.id, status: piece.status }, data: { status: to } });
  if (res.count === 0) throw badRequest("La pieza cambió mientras tanto. Recarga e inténtalo de nuevo.");
  await tx.pieceEvent.create({
    data: {
      pieceId: piece.id,
      fromStatus: piece.status,
      toStatus: to,
      actorId: actor.kind === "user" ? actor.id : null,
      note: opts.note,
    },
  });
  await audit(tx, actor, {
    action: "piece.status",
    entityType: "Piece",
    entityId: piece.id,
    projectId: piece.projectId,
    clientVisible: ["CLIENT_REVIEW", "APPROVED", "FINAL_DELIVERY", "COMPLETED", "CHANGES_REQUESTED"].includes(to),
    data: { from: piece.status, to },
  });
  piece.status = to;
}

export async function createPiece(a: Actor, projectId: string, raw: unknown) {
  const actor = await requireProjectManager(a, projectId);
  const input = pieceInput.parse(raw);
  return db.$transaction(async (tx) => {
    const piece = await tx.piece.create({
      data: {
        organizationId: actor.organizationId,
        projectId,
        title: input.title,
        description: input.description || null,
        format: input.format || null,
        aspectRatio: input.aspectRatio || null,
        resolution: input.resolution || null,
        targetDurationSec: input.targetDurationSec ?? null,
        priority: input.priority as Priority,
        dueDate: input.dueDate,
        status: "PENDING_ASSIGNMENT",
      },
    });
    await tx.pieceEvent.create({ data: { pieceId: piece.id, toStatus: piece.status, actorId: actor.id } });
    await audit(tx, actor, { action: "piece.create", entityType: "Piece", entityId: piece.id, projectId, clientVisible: true, data: { title: piece.title } });
    return piece;
  });
}

export async function updatePiece(a: Actor, pieceId: string, raw: unknown) {
  const piece = await loadPiece(a, pieceId);
  const actor = await requireProjectManager(a, piece.projectId);
  const input = pieceInput.partial().parse(raw);
  return db.$transaction(async (tx) => {
    const p = await tx.piece.update({
      where: { id: pieceId },
      data: {
        title: input.title,
        description: input.description,
        format: input.format,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        targetDurationSec: input.targetDurationSec,
        priority: input.priority as Priority | undefined,
        dueDate: input.dueDate,
      },
    });
    await audit(tx, actor, { action: "piece.update", entityType: "Piece", entityId: p.id, projectId: p.projectId });
    return p;
  });
}

/** Asignar o reasignar editor (null = quitar asignación). */
export async function assignEditor(a: Actor, pieceId: string, editorId: string | null, note?: string) {
  const piece = await loadPiece(a, pieceId);
  const actor = await requireProjectManager(a, piece.projectId);
  if (editorId) {
    const editor = await db.user.findFirst({
      where: { id: editorId, organizationId: actor.organizationId, role: "EDITOR", active: true },
    });
    if (!editor) throw badRequest("Editor no válido");
  }
  if (["COMPLETED", "CANCELLED"].includes(piece.status)) throw badRequest("La pieza está cerrada");
  const previous = piece.editorId;
  return db.$transaction(async (tx) => {
    await tx.piece.update({ where: { id: pieceId }, data: { editorId } });
    const state = { id: piece.id, status: piece.status, projectId: piece.projectId };
    if (editorId && piece.status === "PENDING_ASSIGNMENT") await transitionPiece(tx, state, "ASSIGNED", actor, { system: true });
    if (!editorId && ["ASSIGNED", "IN_EDIT"].includes(piece.status)) {
      await transitionPiece(tx, state, "PENDING_ASSIGNMENT", actor, { system: true });
    }
    await audit(tx, actor, {
      action: previous ? "piece.reassign" : "piece.assign",
      entityType: "Piece",
      entityId: pieceId,
      projectId: piece.projectId,
      data: { from: previous, to: editorId, note: note ?? null },
    });
    if (editorId && editorId !== previous) {
      await notify(tx, {
        organizationId: actor.organizationId,
        type: "ASSIGNED",
        recipients: [editorId],
        title: `Te han asignado «${piece.title}»`,
        body: `Proyecto: ${piece.project.name}`,
        url: `/piezas/${pieceId}`,
        groupKey: `assign:${pieceId}`,
        eventKey: `assign:${pieceId}:${editorId}:${Date.now()}`,
        internal: true,
        excludeUserId: actor.id,
      });
    }
  });
}

/** Transición manual (p.ej. el editor marca "Empiezo a editar"). */
export async function changePieceStatus(a: Actor, pieceId: string, to: PieceStatus) {
  const piece = await loadPiece(a, pieceId);
  if (a.kind !== "user") throw forbidden();
  if (isEditor(a) && piece.editorId !== a.id) throw forbidden();
  if (!isManager(a) && !isEditor(a)) throw forbidden();
  await db.$transaction(async (tx) => {
    await transitionPiece(tx, { id: piece.id, status: piece.status, projectId: piece.projectId }, to, a);
  });
}

export const blockerInput = z.object({
  kind: z.enum(["MISSING_MATERIAL", "PENDING_DECISION", "OTHER"]),
  reason: z.string().trim().min(3, "Explica el motivo").max(1000),
  ownerId: z.string().optional().transform((v) => v || null),
});

export async function addBlocker(a: Actor, pieceId: string, raw: unknown) {
  const piece = await loadPiece(a, pieceId);
  if (a.kind !== "user" || a.role === "CLIENT") throw forbidden();
  if (isEditor(a) && piece.editorId !== a.id) throw forbidden();
  const input = blockerInput.parse(raw);
  if (input.ownerId) {
    const owner = await db.user.findFirst({ where: { id: input.ownerId, organizationId: a.organizationId } });
    if (!owner) throw badRequest("Responsable no válido");
  }
  return db.$transaction(async (tx) => {
    const b = await tx.blocker.create({
      data: { pieceId, kind: input.kind as BlockerKind, reason: input.reason, ownerId: input.ownerId, createdById: a.id },
    });
    await audit(tx, a, { action: "blocker.add", entityType: "Piece", entityId: pieceId, projectId: piece.projectId, data: { kind: input.kind, reason: input.reason } });
    const coordinator = piece.project.coordinatorId;
    await notify(tx, {
      organizationId: a.organizationId,
      type: "BLOCKER",
      recipients: [coordinator, input.ownerId].filter(Boolean) as string[],
      title: `Bloqueo en «${piece.title}»`,
      body: input.reason,
      url: `/piezas/${pieceId}`,
      groupKey: `blocker:${pieceId}`,
      eventKey: `blocker:${b.id}`,
      internal: true,
      excludeUserId: a.id,
    });
    return b;
  });
}

export async function resolveBlocker(a: Actor, blockerId: string) {
  if (a.kind !== "user" || a.role === "CLIENT") throw forbidden();
  const b = await db.blocker.findUnique({ where: { id: blockerId } });
  if (!b) throw badRequest("Bloqueo no encontrado");
  const piece = await loadPiece(a, b.pieceId);
  if (isEditor(a) && piece.editorId !== a.id) throw forbidden();
  await db.$transaction(async (tx) => {
    await tx.blocker.update({ where: { id: blockerId }, data: { resolvedAt: new Date(), resolvedById: a.id } });
    await audit(tx, a, { action: "blocker.resolve", entityType: "Piece", entityId: piece.id, projectId: piece.projectId });
  });
}

export async function getPieceDetail(a: Actor, pieceId: string) {
  await loadPiece(a, pieceId);
  const clientSide = a.kind === "guest" || a.role === "CLIENT";
  return db.piece.findUniqueOrThrow({
    where: { id: pieceId },
    include: {
      project: { include: { client: true, coordinator: { select: { id: true, name: true } } } },
      editor: { select: { id: true, name: true, email: true } },
      versions: {
        where: clientSide ? { publishedAt: { not: null } } : undefined,
        orderBy: { number: "desc" },
        include: {
          uploadedBy: { select: { name: true } },
          previewAsset: { select: { id: true, status: true, filename: true } },
          _count: { select: { comments: { where: { parentId: null, deletedAt: null, ...(clientSide ? { visibility: "CLIENT" } : {}) } } } },
        },
      },
      blockers: { orderBy: { createdAt: "desc" } },
      deliveries: { include: { asset: true, version: { select: { number: true } } }, orderBy: { createdAt: "desc" } },
      events: clientSide ? false : { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}

export async function editorsWithLoad(a: UserActor) {
  const editors = await db.user.findMany({
    where: { organizationId: a.organizationId, role: "EDITOR", active: true },
    include: {
      editorProfile: true,
      piecesEditing: {
        where: { status: { in: ["ASSIGNED", "IN_EDIT", "INTERNAL_REVIEW", "CLIENT_REVIEW", "CHANGES_REQUESTED", "IN_CORRECTION"] } },
        select: { id: true, title: true, dueDate: true, status: true },
      },
    },
    orderBy: { name: "asc" },
  });
  return editors.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    profile: e.editorProfile,
    active: e.piecesEditing,
    load: e.piecesEditing.length,
    capacity: e.editorProfile?.capacity ?? 3,
  }));
}
