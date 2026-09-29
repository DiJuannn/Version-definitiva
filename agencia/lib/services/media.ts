import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { MediaKind } from "@prisma/client";
import { db } from "@/lib/db";
import { isClientUser, isEditor, isInternal, isManager, type Actor } from "@/lib/authz/actor";
import { loadPiece, loadProject } from "@/lib/authz/guards";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/errors";
import { storage } from "@/lib/storage";
import { storageKey } from "@/lib/storage/provider";
import { mediaUrl, signMedia } from "@/lib/storage/signed-url";
import { notify } from "@/lib/notifications/notify";
import { audit } from "./audit";
import { mediaSubject } from "./review";
import { transitionPiece } from "./pieces";

/** Límites del almacenamiento local (dev / servidor propio). Originales grandes → enlace externo o S3. */
export const LOCAL_LIMITS: Record<string, number> = {
  PREVIEW: 8 * 1024 ** 3,
  DELIVERABLE: 8 * 1024 ** 3,
  REFERENCE: 2 * 1024 ** 3,
  SOURCE: 2 * 1024 ** 3,
  ATTACHMENT: 200 * 1024 ** 2,
  PROXY: 8 * 1024 ** 3,
};
export const CHUNK_MAX = 16 * 1024 * 1024;

export const startUploadInput = z.object({
  kind: z.enum(["PREVIEW", "DELIVERABLE", "REFERENCE", "SOURCE"]),
  pieceId: z.string().optional(),
  projectId: z.string().optional(),
  filename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().min(1),
  mimeType: z.string().max(120).optional().default("application/octet-stream"),
  durationMs: z.number().int().positive().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  label: z.string().trim().max(200).optional(),
});

export async function startUpload(a: Actor, raw: unknown) {
  if (a.kind !== "user") throw forbidden();
  const input = startUploadInput.parse(raw);
  const limit = LOCAL_LIMITS[input.kind];
  if (input.sizeBytes > limit) {
    throw badRequest(
      `El archivo supera el límite de ${Math.round(limit / 1024 ** 3)} GB del almacenamiento actual. Para originales grandes añade un enlace externo.`,
    );
  }
  let projectId: string;
  let pieceId: string | null = null;
  let visibility: "INTERNAL" | "CLIENT" = "INTERNAL";
  if (input.kind === "PREVIEW" || input.kind === "DELIVERABLE") {
    if (!input.pieceId) throw badRequest("Falta la pieza");
    const piece = await loadPiece(a, input.pieceId);
    if (input.kind === "PREVIEW" && !(isManager(a) || (isEditor(a) && piece.editorId === a.id))) throw forbidden();
    if (input.kind === "DELIVERABLE" && !isManager(a)) throw forbidden("Solo coordinación entrega archivos finales");
    if (input.kind === "DELIVERABLE" && !piece.approvedVersionId) throw badRequest("La entrega final requiere una versión aprobada");
    if (!input.mimeType.startsWith("video/") && input.kind === "PREVIEW") throw badRequest("La versión de revisión debe ser un archivo de vídeo");
    projectId = piece.projectId;
    pieceId = piece.id;
  } else {
    if (!input.projectId) throw badRequest("Falta el proyecto");
    await loadProject(a, input.projectId);
    if (!isInternal(a) && !isClientUser(a)) throw forbidden();
    projectId = input.projectId;
    visibility = isClientUser(a) ? "CLIENT" : "INTERNAL";
  }

  const asset = await db.mediaAsset.create({
    data: {
      organizationId: a.organizationId,
      kind: input.kind as MediaKind,
      provider: "LOCAL",
      filename: input.filename,
      label: input.label,
      mimeType: input.mimeType,
      sizeBytes: BigInt(input.sizeBytes),
      status: "UPLOADING",
      visibility,
      projectId,
      pieceId,
      durationMs: input.durationMs ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      createdById: a.id,
    },
  });
  const key = storageKey({ organizationId: a.organizationId, kind: asset.kind, assetId: asset.id, filename: asset.filename });
  await db.mediaAsset.update({ where: { id: asset.id }, data: { storageKey: key } });
  return { assetId: asset.id, chunkSize: 8 * 1024 * 1024, uploadedBytes: 0 };
}

async function ownUpload(a: Actor, assetId: string) {
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, organizationId: a.organizationId } });
  if (!asset || a.kind !== "user" || asset.createdById !== a.id) throw notFound("Subida");
  return asset;
}

export async function uploadStatus(a: Actor, assetId: string) {
  const asset = await ownUpload(a, assetId);
  return { status: asset.status, uploadedBytes: Number(asset.uploadedBytes), sizeBytes: Number(asset.sizeBytes ?? 0) };
}

/**
 * Añade un trozo en `offset`. Si el offset no coincide con lo ya recibido se
 * responde 409 con el offset correcto para que el cliente reanude desde ahí.
 */
export async function appendChunk(a: Actor, assetId: string, offset: number, data: Uint8Array, sha?: string | null) {
  const asset = await ownUpload(a, assetId);
  if (asset.status !== "UPLOADING" || !asset.storageKey) throw badRequest("La subida no está activa");
  if (data.length === 0 || data.length > CHUNK_MAX) throw badRequest("Tamaño de trozo no válido");
  const current = Number(asset.uploadedBytes);
  if (offset !== current) throw conflict(`offset:${current}`);
  if (current + data.length > Number(asset.sizeBytes)) throw badRequest("El archivo es más grande de lo declarado");
  if (sha && createHash("sha256").update(data).digest("hex") !== sha) {
    throw badRequest("El trozo llegó dañado (suma de verificación distinta). Se reintentará.");
  }
  // Reserva el rango con una actualización condicional para evitar escrituras concurrentes.
  const claimed = await db.mediaAsset.updateMany({
    where: { id: assetId, uploadedBytes: BigInt(current), status: "UPLOADING" },
    data: { uploadedBytes: BigInt(current + data.length) },
  });
  if (claimed.count === 0) throw conflict(`offset:${current}`);
  try {
    await storage().writeChunk(asset.storageKey, offset, data);
  } catch (err) {
    await db.mediaAsset.update({ where: { id: assetId }, data: { uploadedBytes: BigInt(current) } });
    throw err;
  }
  return { uploadedBytes: current + data.length };
}

export async function completeUpload(a: Actor, assetId: string) {
  const asset = await ownUpload(a, assetId);
  if (asset.status === "READY") return { status: "READY", sha256: asset.checksumSha256 };
  if (!asset.storageKey) throw badRequest("Subida no válida");
  const size = await storage().size(asset.storageKey);
  if (size !== Number(asset.sizeBytes)) {
    throw badRequest(`Faltan datos: recibidos ${size ?? 0} de ${asset.sizeBytes} bytes`);
  }
  const sha = await storage().sha256(asset.storageKey);
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "READY", checksumSha256: sha, error: null } });
  return { status: "READY", sha256: sha };
}

export async function cancelUpload(a: Actor, assetId: string) {
  const asset = await ownUpload(a, assetId);
  if (asset.status === "READY") throw badRequest("La subida ya terminó");
  if (asset.storageKey) await storage().delete(asset.storageKey);
  await db.mediaAsset.update({ where: { id: assetId }, data: { status: "FAILED", error: "Cancelada", deletedAt: new Date() } });
}

export const externalLinkInput = z.object({
  projectId: z.string(),
  kind: z.enum(["SOURCE", "REFERENCE"]),
  url: z.string().trim().url("Pega un enlace válido (https://…)").refine((u) => u.startsWith("https://") || u.startsWith("http://"), "Solo enlaces http(s)"),
  label: z.string().trim().max(200).optional().default(""),
});

/** Detecta el servicio del enlace. Es solo una etiqueta: NO es una integración con su API. */
export function linkService(url: string): string {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();
  if (host.includes("drive.google")) return "Google Drive";
  if (host.includes("dropbox")) return "Dropbox";
  if (host.includes("wetransfer") || host.includes("we.tl")) return "WeTransfer";
  if (host.includes("frame.io") || host.includes("f.io")) return "Frame.io";
  if (host.includes("vimeo")) return "Vimeo";
  if (host.includes("youtu")) return "YouTube";
  if (host.includes("box.com")) return "Box";
  return host || "Enlace";
}

export async function addExternalLink(a: Actor, raw: unknown) {
  if (a.kind !== "user") throw forbidden();
  const input = externalLinkInput.parse(raw);
  await loadProject(a, input.projectId);
  if (!isInternal(a) && !isClientUser(a)) throw forbidden();
  return db.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.create({
      data: {
        organizationId: a.organizationId,
        kind: input.kind,
        provider: "EXTERNAL_LINK",
        externalUrl: input.url,
        filename: input.label || linkService(input.url),
        label: input.label || null,
        status: "READY",
        visibility: isClientUser(a) ? "CLIENT" : "INTERNAL",
        projectId: input.projectId,
        createdById: a.id,
      },
    });
    await audit(tx, a, { action: "material.link", entityType: "MediaAsset", entityId: asset.id, projectId: input.projectId, clientVisible: isClientUser(a) });
    return asset;
  });
}

export async function setMaterialVisibility(a: Actor, assetId: string, visibility: "INTERNAL" | "CLIENT") {
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, organizationId: a.organizationId, kind: { in: ["SOURCE", "REFERENCE"] } } });
  if (!asset?.projectId) throw notFound("Material");
  await loadProject(a, asset.projectId);
  if (!isManager(a)) throw forbidden();
  await db.mediaAsset.update({ where: { id: assetId }, data: { visibility } });
}

export async function listMaterials(a: Actor, projectId: string) {
  await loadProject(a, projectId);
  return db.mediaAsset.findMany({
    where: {
      projectId,
      kind: { in: ["SOURCE", "REFERENCE"] },
      deletedAt: null,
      status: { in: ["READY", "UPLOADING"] },
      ...(isInternal(a) ? {} : { visibility: "CLIENT" }),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Autoriza una descarga y devuelve una URL firmada de corta duración.
 * Registra la descarga (DownloadLog y evento del enlace si es invitado).
 */
export async function requestDownload(a: Actor, assetId: string, ip?: string | null) {
  const asset = await db.mediaAsset.findFirst({
    where: { id: assetId, organizationId: a.organizationId, deletedAt: null, status: "READY" },
    include: { delivery: true, versionPreview: { select: { id: true, publishedAt: true } } },
  });
  if (!asset) throw notFound("Archivo");
  if (asset.provider === "EXTERNAL_LINK") throw badRequest("Es un enlace externo: ábrelo directamente");

  let allowed = false;
  if (asset.pieceId) {
    await loadPiece(a, asset.pieceId);
    if (isInternal(a)) allowed = true;
    else if (asset.kind === "DELIVERABLE" && asset.delivery) {
      allowed = a.kind === "guest" ? a.link.canDownload : true;
    } else if (asset.kind === "PREVIEW" && asset.versionPreview?.publishedAt) {
      allowed = a.kind === "guest" && a.link.canDownload;
    }
  } else if (asset.projectId) {
    await loadProject(a, asset.projectId);
    allowed = isInternal(a) || (a.kind === "user" && asset.visibility === "CLIENT");
  }
  if (!allowed) throw forbidden("No tienes permiso para descargar este archivo");

  await db.$transaction(async (tx) => {
    await tx.downloadLog.create({
      data: { assetId, actorUserId: a.kind === "user" ? a.id : null, actorGuestId: a.kind === "guest" ? a.id : null, ip: ip ?? null },
    });
    if (a.kind === "guest") await tx.shareLinkEvent.create({ data: { shareLinkId: a.link.id, guestId: a.id, type: "DOWNLOADED", data: { assetId } } });
    await audit(tx, a, { action: "media.download", entityType: "MediaAsset", entityId: assetId, projectId: asset.projectId, clientVisible: asset.kind === "DELIVERABLE" });
  });
  return { url: mediaUrl(signMedia({ assetId, subject: mediaSubject(a), download: true }, 10 * 60_000)) };
}

export async function createDelivery(a: Actor, pieceId: string, assetId: string, note?: string) {
  const piece = await loadPiece(a, pieceId);
  if (!isManager(a)) throw forbidden();
  if (!piece.approvedVersionId) throw badRequest("La entrega final requiere una versión aprobada");
  const asset = await db.mediaAsset.findFirst({ where: { id: assetId, pieceId, kind: "DELIVERABLE", status: "READY" }, include: { delivery: true } });
  if (!asset) throw badRequest("Archivo de entrega no válido");
  if (asset.delivery) throw conflict("Ese archivo ya está entregado");
  const approvedVersionId = piece.approvedVersionId;
  return db.$transaction(async (tx) => {
    const d = await tx.delivery.create({ data: { pieceId, versionId: approvedVersionId, assetId, note: note || null, createdById: a.id } });
    await tx.mediaAsset.update({ where: { id: assetId }, data: { visibility: "CLIENT" } });
    if (piece.status === "APPROVED") {
      await transitionPiece(tx, { id: piece.id, status: piece.status, projectId: piece.projectId }, "FINAL_DELIVERY", a, { system: true });
    }
    await audit(tx, a, { action: "delivery.create", entityType: "Delivery", entityId: d.id, projectId: piece.projectId, clientVisible: true, data: { filename: asset.filename } });
    const clientUsers = await tx.user.findMany({ where: { organizationId: a.organizationId, clientId: piece.project.clientId, role: "CLIENT", active: true }, select: { id: true } });
    await notify(tx, {
      organizationId: a.organizationId,
      type: "DELIVERY",
      recipients: clientUsers.map((u) => u.id),
      title: `Entrega final disponible: «${piece.title}»`,
      url: `/piezas/${pieceId}`,
      groupKey: `delivery:${pieceId}`,
      eventKey: `delivery:${d.id}`,
      internal: false,
    });
    return d;
  });
}
