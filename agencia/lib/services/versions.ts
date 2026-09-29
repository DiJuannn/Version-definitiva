import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { isEditor, isManager, type Actor } from "@/lib/authz/actor";
import { loadPiece, loadVersion } from "@/lib/authz/guards";
import { canTransitionVersion } from "@/lib/domain/version-status";
import { badRequest, conflict, forbidden } from "@/lib/http/errors";
import { notify } from "@/lib/notifications/notify";
import { audit } from "./audit";
import { transitionPiece } from "./pieces";

export const newVersionInput = z.object({
  assetId: z.string().min(1),
  changeSummary: z.string().trim().max(4000).optional().default(""),
  // Metadatos leídos por el navegador al elegir el archivo (no verificados por un pipeline).
  durationMs: z.number().int().min(1).max(24 * 3600_000).nullable().optional(),
  width: z.number().int().min(1).max(16384).nullable().optional(),
  height: z.number().int().min(1).max(16384).nullable().optional(),
  fps: z.number().min(1).max(240).nullable().optional(),
  addressedCorrectionIds: z.array(z.string()).max(500).optional().default([]),
  sourceUrl: z
    .string()
    .trim()
    .url("El enlace al máster no es una URL válida")
    .optional()
    .or(z.literal(""))
    .transform((v) => v || null),
});

/** El editor (o gestión) publica un nuevo montaje. Siempre entra como versión interna. */
export async function createVersion(a: Actor, pieceId: string, raw: unknown) {
  const piece = await loadPiece(a, pieceId);
  if (!(isManager(a) || (isEditor(a) && piece.editorId === a.id))) throw forbidden("Solo el editor asignado o coordinación pueden subir versiones");
  if (["COMPLETED", "CANCELLED", "DRAFT", "PENDING_ASSIGNMENT"].includes(piece.status)) {
    throw badRequest("La pieza no admite nuevas versiones en su estado actual");
  }
  const input = newVersionInput.parse(raw);
  const asset = await db.mediaAsset.findFirst({
    where: { id: input.assetId, organizationId: a.organizationId, pieceId, kind: "PREVIEW" },
    include: { versionPreview: true },
  });
  if (!asset || asset.status !== "READY") throw badRequest("El archivo todavía no se ha subido completo");
  if (asset.versionPreview) throw conflict("Ese archivo ya pertenece a otra versión");

  return db.$transaction(async (tx) => {
    const last = await tx.version.findFirst({ where: { pieceId }, orderBy: { number: "desc" } });
    const number = (last?.number ?? 0) + 1;
    let sourceAssetId: string | null = null;
    if (input.sourceUrl) {
      const src = await tx.mediaAsset.create({
        data: {
          organizationId: a.organizationId,
          kind: "SOURCE",
          provider: "EXTERNAL_LINK",
          externalUrl: input.sourceUrl,
          filename: `Máster V${number}`,
          status: "READY",
          pieceId,
          projectId: piece.projectId,
          createdById: a.kind === "user" ? a.id : null,
        },
      });
      sourceAssetId = src.id;
    }
    const version = await tx.version.create({
      data: {
        pieceId,
        number,
        status: "INTERNAL_REVIEW",
        changeSummary: input.changeSummary || null,
        uploadedById: (a as { id: string }).id,
        previewAssetId: asset.id,
        sourceAssetId,
        durationMs: input.durationMs ?? asset.durationMs,
        width: input.width ?? asset.width,
        height: input.height ?? asset.height,
        fps: input.fps ?? null,
        fpsVerified: false,
      },
    });
    // Las versiones internas anteriores sin decisión quedan sustituidas.
    await tx.version.updateMany({
      where: { pieceId, id: { not: version.id }, status: { in: ["INTERNAL_REVIEW", "INTERNAL_CHANGES"] } },
      data: { status: "SUPERSEDED" },
    });
    await tx.piece.update({ where: { id: pieceId }, data: { currentVersionId: version.id } });

    // Correcciones que el editor declara atendidas en esta versión.
    if (input.addressedCorrectionIds.length) {
      const corrections = await tx.correction.findMany({
        where: { id: { in: input.addressedCorrectionIds }, pieceId, status: { in: ["PENDING", "IN_PROGRESS"] } },
      });
      for (const c of corrections) {
        await tx.correction.update({ where: { id: c.id }, data: { status: "RESOLVED", addressedInVersionId: version.id } });
        await tx.correctionEvent.create({
          data: { correctionId: c.id, fromStatus: c.status, toStatus: "RESOLVED", actorUserId: (a as { id: string }).id, note: `Atendida en V${number}` },
        });
      }
    }

    const state = { id: piece.id, status: piece.status, projectId: piece.projectId };
    if (piece.status !== "INTERNAL_REVIEW") await transitionPiece(tx, state, "INTERNAL_REVIEW", a, { system: true });
    await audit(tx, a, {
      action: "version.create",
      entityType: "Version",
      entityId: version.id,
      projectId: piece.projectId,
      data: { number, addressed: input.addressedCorrectionIds.length },
    });
    await notify(tx, {
      organizationId: a.organizationId,
      type: "NEW_VERSION",
      recipients: [piece.project.coordinatorId].filter(Boolean) as string[],
      title: `V${number} de «${piece.title}» lista para revisión interna`,
      body: input.changeSummary || undefined,
      url: `/revision/${version.id}`,
      groupKey: `newversion:${pieceId}`,
      eventKey: `version:${version.id}`,
      internal: true,
      excludeUserId: (a as { id: string }).id,
    });
    return version;
  });
}

/** Coordinación publica la versión al cliente tras la revisión interna. */
export async function publishVersion(a: Actor, versionId: string, note?: string) {
  const v = await loadVersion(a, versionId);
  if (!isManager(a)) throw forbidden("Solo coordinación o administración pueden publicar al cliente");
  if (!canTransitionVersion(v.status, "CLIENT_REVIEW")) throw badRequest("Esta versión no se puede publicar en su estado actual");
  const piece = v.piece;
  return db.$transaction(async (tx) => {
    const res = await tx.version.updateMany({
      where: { id: versionId, status: v.status },
      data: { status: "CLIENT_REVIEW", publishedAt: new Date(), publishedById: a.id },
    });
    if (res.count === 0) throw conflict("La versión cambió mientras tanto. Recarga la página.");
    if (v.previewAssetId) await tx.mediaAsset.update({ where: { id: v.previewAssetId }, data: { visibility: "CLIENT" } });
    // La versión que el cliente estaba revisando sin decidir queda sustituida.
    await tx.version.updateMany({
      where: { pieceId: piece.id, id: { not: versionId }, status: "CLIENT_REVIEW" },
      data: { status: "SUPERSEDED" },
    });
    await tx.piece.update({ where: { id: piece.id }, data: { clientVersionId: versionId } });
    await transitionPiece(tx, { id: piece.id, status: piece.status, projectId: piece.projectId }, "CLIENT_REVIEW", a, { system: true });
    await audit(tx, a, {
      action: "version.publish",
      entityType: "Version",
      entityId: versionId,
      projectId: piece.projectId,
      clientVisible: true,
      data: { number: v.number, note: note ?? null },
    });
    const clientUsers = await tx.user.findMany({
      where: { organizationId: a.organizationId, clientId: piece.project.clientId, role: "CLIENT", active: true },
      select: { id: true },
    });
    await notify(tx, {
      organizationId: a.organizationId,
      type: "VERSION_PUBLISHED",
      recipients: [...clientUsers.map((u) => u.id), piece.editorId].filter(Boolean) as string[],
      title: `Nueva versión para revisar: «${piece.title}» V${v.number}`,
      url: `/revision/${versionId}`,
      groupKey: `published:${piece.id}`,
      eventKey: `publish:${versionId}`,
      internal: false,
      excludeUserId: a.id,
    });
  });
}

/** Coordinación pide cambios antes de enseñar la versión al cliente. */
export async function requestInternalChanges(a: Actor, versionId: string, note: string) {
  const v = await loadVersion(a, versionId);
  if (!isManager(a)) throw forbidden();
  if (!canTransitionVersion(v.status, "INTERNAL_CHANGES")) throw badRequest("Solo se pueden pedir cambios internos en una versión en revisión interna");
  const piece = v.piece;
  await db.$transaction(async (tx) => {
    const res = await tx.version.updateMany({ where: { id: versionId, status: v.status }, data: { status: "INTERNAL_CHANGES" } });
    if (res.count === 0) throw conflict("La versión cambió mientras tanto. Recarga la página.");
    const hadClientVersion = !!piece.clientVersionId;
    await transitionPiece(tx, { id: piece.id, status: piece.status, projectId: piece.projectId }, hadClientVersion ? "IN_CORRECTION" : "IN_EDIT", a, {
      system: true,
      note,
    });
    await audit(tx, a, { action: "version.internal_changes", entityType: "Version", entityId: versionId, projectId: piece.projectId, data: { note } });
    await notify(tx, {
      organizationId: a.organizationId,
      type: "INTERNAL_CHANGES",
      recipients: [piece.editorId].filter(Boolean) as string[],
      title: `Cambios internos en «${piece.title}» V${v.number}`,
      body: note,
      url: `/revision/${versionId}`,
      groupKey: `internalchanges:${versionId}`,
      eventKey: `internalchanges:${versionId}:${Date.now()}`,
      internal: true,
      excludeUserId: a.id,
    });
  });
}
