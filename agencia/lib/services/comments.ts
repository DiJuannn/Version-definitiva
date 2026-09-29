import "server-only";
import { z } from "zod";
import type { CorrectionCategory, Prisma, Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { isInternal, isManager, type Actor } from "@/lib/authz/actor";
import { loadVersion } from "@/lib/authz/guards";
import { commentVisibility } from "@/lib/authz/scope";
import { annotationSchema } from "@/lib/domain/annotation";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { notify } from "@/lib/notifications/notify";
import { audit } from "./audit";
import { reviewParticipants } from "./participants";

const CATEGORIES = ["VIDEO", "AUDIO", "COLOR", "SUBTITLES", "MOTION_GRAPHICS", "BRANDING", "OTHER"] as const;

export const commentInput = z
  .object({
    body: z.string().trim().min(1, "Escribe el comentario").max(5000, "El comentario es demasiado largo"),
    timeMs: z.number().int().min(0).nullable().optional(),
    endMs: z.number().int().min(0).nullable().optional(),
    visibility: z.enum(["INTERNAL", "CLIENT"]).optional(),
    annotation: annotationSchema.nullable().optional(),
    parentId: z.string().nullable().optional(),
    isCorrection: z.boolean().optional(),
    category: z.enum(CATEGORIES).optional(),
    mentionIds: z.array(z.string()).max(20).optional().default([]),
  })
  .refine((c) => c.endMs == null || (c.timeMs != null && c.endMs > c.timeMs), {
    message: "El final del tramo debe ser posterior al inicio",
    path: ["endMs"],
  })
  .refine((c) => !c.annotation || c.timeMs != null, { message: "Un dibujo necesita un instante", path: ["annotation"] });

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;

export function extractLinks(body: string): string[] {
  return [...new Set(body.match(URL_RE) ?? [])].slice(0, 20);
}

function authorFields(a: Actor) {
  return a.kind === "user" ? { authorUserId: a.id } : { authorGuestId: a.id };
}

function canCommentOn(a: Actor, version: { publishedAt: Date | null; piece: { editorId: string | null } }) {
  if (a.kind === "guest") return a.link.canComment && version.publishedAt !== null;
  if (a.role === "CLIENT") return version.publishedAt !== null;
  return true;
}

export async function addComment(a: Actor, versionId: string, raw: unknown) {
  const version = await loadVersion(a, versionId);
  if (!canCommentOn(a, version)) throw forbidden("No puedes comentar en esta versión");
  if (version.lockedAt) throw forbidden("La versión está aprobada: su conversación está cerrada");
  const input = commentInput.parse(raw);
  if (version.durationMs && input.timeMs != null && input.timeMs > version.durationMs + 1000) {
    throw badRequest("El instante está fuera de la duración del vídeo");
  }

  let parent: { id: string; visibility: Visibility; authorUserId: string | null; parentId: string | null } | null = null;
  if (input.parentId) {
    parent = await db.comment.findFirst({
      where: { id: input.parentId, versionId, deletedAt: null, ...commentVisibility(a) },
      select: { id: true, visibility: true, authorUserId: true, parentId: true },
    });
    if (!parent) throw notFound("Comentario");
    if (parent.parentId) throw badRequest("Solo se responde al comentario principal");
  }

  // Visibilidad: clientes e invitados siempre en la conversación del cliente;
  // en versiones internas todo es interno; una respuesta a un hilo interno es interna.
  let visibility: Visibility;
  if (!isInternal(a)) visibility = "CLIENT";
  else if (!version.publishedAt) visibility = "INTERNAL";
  else if (parent?.visibility === "INTERNAL") visibility = "INTERNAL";
  else visibility = input.visibility ?? "CLIENT";

  // Menciones: solo participantes que pueden ver este comentario.
  const participants = await reviewParticipants(a, version, visibility);
  const allowed = new Set(participants.map((p) => p.id));
  const mentionIds = input.mentionIds.filter((id) => allowed.has(id));

  const isRoot = !parent;
  const makeCorrection = isRoot && (input.isCorrection ?? input.timeMs != null);
  const piece = version.piece;

  const comment = await db.$transaction(async (tx) => {
    const c = await tx.comment.create({
      data: {
        versionId,
        parentId: parent?.id ?? null,
        ...authorFields(a),
        body: input.body,
        timeMs: isRoot ? (input.timeMs ?? null) : null,
        endMs: isRoot ? (input.endMs ?? null) : null,
        visibility,
        annotation: isRoot && input.annotation ? (input.annotation as Prisma.InputJsonValue) : undefined,
        links: extractLinks(input.body),
        mentions: mentionIds.length ? { create: mentionIds.map((userId) => ({ userId })) } : undefined,
      },
    });
    if (parent) await tx.comment.update({ where: { id: parent.id }, data: { lastActivityAt: new Date() } });
    if (makeCorrection) {
      const correction = await tx.correction.create({
        data: {
          commentId: c.id,
          pieceId: piece.id,
          originVersionId: versionId,
          category: (input.category ?? "OTHER") as CorrectionCategory,
          assigneeId: piece.editorId,
        },
      });
      await tx.correctionEvent.create({
        data: {
          correctionId: correction.id,
          toStatus: "PENDING",
          actorUserId: a.kind === "user" ? a.id : null,
          actorGuestId: a.kind === "guest" ? a.id : null,
        },
      });
    }
    await audit(tx, a, {
      action: parent ? "comment.reply" : "comment.create",
      entityType: "Comment",
      entityId: c.id,
      projectId: piece.projectId,
      data: { versionId, visibility },
    });
    if (a.kind === "guest") {
      await tx.shareLinkEvent.create({ data: { shareLinkId: a.link.id, guestId: a.id, type: "COMMENTED", data: { versionId } } });
    }

    const url = `/revision/${versionId}?c=${c.id}`;
    const internal = visibility === "INTERNAL";
    const who = a.name;
    const excerpt = input.body.slice(0, 160);
    const selfId = a.kind === "user" ? a.id : null;
    if (parent?.authorUserId) {
      await notify(tx, {
        organizationId: a.organizationId,
        type: "REPLY",
        recipients: [parent.authorUserId],
        title: `${who} respondió en «${piece.title}»`,
        body: excerpt,
        url,
        groupKey: `reply:${parent.id}`,
        eventKey: `comment:${c.id}:reply`,
        internal,
        excludeUserId: selfId,
      });
    }
    if (!parent) {
      await notify(tx, {
        organizationId: a.organizationId,
        type: "COMMENT",
        recipients: [piece.editorId, piece.project.coordinatorId].filter(Boolean) as string[],
        title: `Nuevo comentario en «${piece.title}» V${version.number}`,
        body: `${who}: ${excerpt}`,
        url,
        groupKey: `comments:${versionId}`,
        eventKey: `comment:${c.id}`,
        internal: true,
        excludeUserId: selfId,
      });
    }
    if (mentionIds.length) {
      await notify(tx, {
        organizationId: a.organizationId,
        type: "MENTION",
        recipients: mentionIds,
        title: `${who} te mencionó en «${piece.title}»`,
        body: excerpt,
        url,
        groupKey: `mention:${c.id}`,
        eventKey: `comment:${c.id}:mention`,
        internal,
        excludeUserId: selfId,
      });
    }
    return c;
  });
  return comment;
}

function isAuthor(a: Actor, c: { authorUserId: string | null; authorGuestId: string | null }) {
  return a.kind === "user" ? c.authorUserId === a.id : c.authorGuestId === a.id;
}

async function loadComment(a: Actor, commentId: string) {
  const c = await db.comment.findUnique({ where: { id: commentId } });
  if (!c) throw notFound("Comentario");
  const version = await loadVersion(a, c.versionId);
  if (c.visibility === "INTERNAL" && !isInternal(a)) throw notFound("Comentario");
  return { c, version };
}

export async function editComment(a: Actor, commentId: string, body: string) {
  const text = z.string().trim().min(1, "El comentario no puede quedar vacío").max(5000).parse(body);
  const { c, version } = await loadComment(a, commentId);
  if (!isAuthor(a, c)) throw forbidden("Solo quien escribió el comentario puede editarlo");
  if (c.deletedAt) throw badRequest("El comentario está retirado");
  if (version.lockedAt) throw badRequest("La versión está aprobada: su conversación ya no se puede modificar");
  if (text === c.body) return c;
  return db.$transaction(async (tx) => {
    await tx.commentRevision.create({
      data: {
        commentId,
        body: c.body,
        action: "EDIT",
        actorUserId: a.kind === "user" ? a.id : null,
        actorGuestId: a.kind === "guest" ? a.id : null,
      },
    });
    const updated = await tx.comment.update({
      where: { id: commentId },
      data: { body: text, links: extractLinks(text), editedAt: new Date(), lastActivityAt: new Date() },
    });
    await audit(tx, a, { action: "comment.edit", entityType: "Comment", entityId: commentId, projectId: version.piece.projectId });
    return updated;
  });
}

/** Retirar = borrado lógico con historial (el texto original queda en CommentRevision). */
export async function withdrawComment(a: Actor, commentId: string) {
  const { c, version } = await loadComment(a, commentId);
  if (!(isAuthor(a, c) || isManager(a))) throw forbidden("No puedes retirar este comentario");
  if (c.deletedAt) return;
  if (version.lockedAt) throw badRequest("La versión está aprobada: su conversación ya no se puede modificar");
  await db.$transaction(async (tx) => {
    await tx.commentRevision.create({
      data: {
        commentId,
        body: c.body,
        action: "DELETE",
        actorUserId: a.kind === "user" ? a.id : null,
        actorGuestId: a.kind === "guest" ? a.id : null,
      },
    });
    await tx.comment.update({ where: { id: commentId }, data: { deletedAt: new Date(), body: "" } });
    const corr = await tx.correction.findUnique({ where: { commentId } });
    if (corr && corr.status !== "DISMISSED") {
      await tx.correction.update({ where: { id: corr.id }, data: { status: "DISMISSED" } });
      await tx.correctionEvent.create({
        data: {
          correctionId: corr.id,
          fromStatus: corr.status,
          toStatus: "DISMISSED",
          actorUserId: a.kind === "user" ? a.id : null,
          actorGuestId: a.kind === "guest" ? a.id : null,
          note: "Comentario retirado",
        },
      });
    }
    await audit(tx, a, { action: "comment.withdraw", entityType: "Comment", entityId: commentId, projectId: version.piece.projectId });
  });
}
