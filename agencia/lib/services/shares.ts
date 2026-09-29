import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, randomToken, sha256, verifyPassword } from "@/lib/auth/crypto";
import { guestCookieName, isLinkUsable } from "@/lib/auth/guest";
import { rateLimit } from "@/lib/auth/rate-limit";
import { isManager, type Actor } from "@/lib/authz/actor";
import { loadPiece, loadProject, loadVersion } from "@/lib/authz/guards";
import { AppError, badRequest, forbidden, notFound } from "@/lib/http/errors";
import { audit } from "./audit";

export const shareInput = z.object({
  name: z.string().trim().min(2, "Pon un nombre al enlace").max(120),
  scope: z.enum(["PROJECT", "PIECE", "VERSION"]),
  projectId: z.string(),
  pieceId: z.string().optional().transform((v) => v || null),
  versionId: z.string().optional().transform((v) => v || null),
  canComment: z.boolean().default(true),
  canApprove: z.boolean().default(false),
  canDownload: z.boolean().default(false),
  requireIdentity: z.boolean().default(true),
  password: z.string().max(200).optional().transform((v) => v || null),
  allowedDomain: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v.replace(/^@/, "") : null))
    .refine((v) => v === null || /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), "Dominio no válido"),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

export async function createShareLink(a: Actor, raw: unknown) {
  if (!isManager(a)) throw forbidden();
  const input = shareInput.parse(raw);
  await loadProject(a, input.projectId);
  if (input.scope !== "PROJECT") {
    if (!input.pieceId) throw badRequest("Falta la pieza");
    const piece = await loadPiece(a, input.pieceId);
    if (piece.projectId !== input.projectId) throw badRequest("La pieza no pertenece al proyecto");
  }
  if (input.scope === "VERSION") {
    if (!input.versionId) throw badRequest("Falta la versión");
    const v = await loadVersion(a, input.versionId);
    if (v.pieceId !== input.pieceId) throw badRequest("La versión no pertenece a la pieza");
    if (!v.publishedAt) throw badRequest("Solo se comparten versiones publicadas al cliente");
  }
  if (input.canApprove && !input.requireIdentity) throw badRequest("Para aprobar, el enlace debe pedir nombre y email");
  const token = randomToken(24);
  return db.$transaction(async (tx) => {
    const link = await tx.shareLink.create({
      data: {
        organizationId: a.organizationId,
        tokenHash: sha256(token),
        tokenPrefix: token.slice(0, 6),
        name: input.name,
        scope: input.scope,
        projectId: input.projectId,
        pieceId: input.scope === "PROJECT" ? null : input.pieceId,
        versionId: input.scope === "VERSION" ? input.versionId : null,
        canComment: input.canComment,
        canApprove: input.canApprove,
        canDownload: input.canDownload,
        requireIdentity: input.requireIdentity,
        passwordHash: input.password ? await hashPassword(input.password) : null,
        allowedDomain: input.allowedDomain,
        expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400_000) : null,
        createdById: a.id,
      },
    });
    await audit(tx, a, { action: "share.create", entityType: "ShareLink", entityId: link.id, projectId: input.projectId, data: { scope: input.scope } });
    // El token solo se muestra una vez: en BD guardamos su hash.
    return { link, token };
  });
}

export async function revokeShareLink(a: Actor, linkId: string) {
  if (!isManager(a)) throw forbidden();
  const link = await db.shareLink.findFirst({ where: { id: linkId, organizationId: a.organizationId } });
  if (!link) throw notFound("Enlace");
  await loadProject(a, link.projectId);
  await db.$transaction(async (tx) => {
    await tx.shareLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } });
    await audit(tx, a, { action: "share.revoke", entityType: "ShareLink", entityId: linkId, projectId: link.projectId });
  });
}

export async function listShareLinks(a: Actor, projectId: string) {
  if (!isManager(a)) throw forbidden();
  await loadProject(a, projectId);
  return db.shareLink.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { guests: true } }, events: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
}

/** Busca un enlace por token (sin exponer si existe cuando está revocado). */
export async function findLinkByToken(token: string) {
  if (!token || token.length < 16 || token.length > 64) return null;
  const link = await db.shareLink.findUnique({ where: { tokenHash: sha256(token) } });
  if (!link) return null;
  return { link, usable: isLinkUsable(link) };
}

export const identifyInput = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().email("Email no válido").max(200).optional().or(z.literal("")),
  password: z.string().max(200).optional(),
});

/** El invitado se identifica (y da la contraseña si el enlace la pide). */
export async function identifyGuest(token: string, raw: unknown, ip: string | null) {
  const found = await findLinkByToken(token);
  if (!found || !found.usable) throw notFound("Enlace");
  const { link } = found;
  if (!(await rateLimit(`share:${link.id}:${ip ?? "?"}`, 20, 15 * 60_000))) {
    throw new AppError(429, "Demasiados intentos. Espera unos minutos.", "rate_limited");
  }
  const input = identifyInput.parse(raw);
  if (link.passwordHash && !(await verifyPassword(input.password ?? "", link.passwordHash))) {
    throw new AppError(401, "Contraseña incorrecta", "bad_password");
  }
  const email = input.email || null;
  if (link.requireIdentity && !email) throw badRequest("Escribe tu email");
  if (link.allowedDomain && (!email || !email.endsWith(`@${link.allowedDomain}`))) {
    throw forbidden(`Este enlace solo admite emails de ${link.allowedDomain}`);
  }
  const sessionToken = randomToken();
  const guest = await db.$transaction(async (tx) => {
    const g = await tx.reviewGuest.create({ data: { shareLinkId: link.id, name: input.name, email, sessionTokenHash: sha256(sessionToken) } });
    await tx.shareLinkEvent.create({ data: { shareLinkId: link.id, guestId: g.id, type: "OPENED" } });
    return g;
  });
  const jar = await cookies();
  jar.set(guestCookieName(link.id), sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
  return { linkId: link.id, guestId: guest.id };
}
