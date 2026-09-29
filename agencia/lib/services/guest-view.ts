import "server-only";
import { db } from "@/lib/db";
import { getGuestActor } from "@/lib/auth/guest";
import { pieceScope, versionScope } from "@/lib/authz/scope";
import type { GuestActor } from "@/lib/authz/actor";
import { findLinkByToken } from "./shares";

/** Resuelve token → enlace → invitado identificado (o qué falta para entrar). */
export async function resolveGuest(token: string) {
  const found = await findLinkByToken(token);
  if (!found) return { state: "invalid" as const };
  if (!found.usable) return { state: "expired" as const, link: found.link };
  const guest = await getGuestActor(found.link.id);
  if (!guest) return { state: "identify" as const, link: found.link };
  return { state: "ok" as const, link: found.link, guest };
}

export async function guestContents(g: GuestActor) {
  const project = await db.project.findUnique({ where: { id: g.link.projectId }, select: { name: true, client: { select: { name: true } } } });
  const pieces = await db.piece.findMany({
    where: pieceScope(g),
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      approvedVersionId: true,
      versions: { where: versionScope(g), orderBy: { number: "desc" }, select: { id: true, number: true, status: true, publishedAt: true } },
      deliveries: { select: { id: true, assetId: true, asset: { select: { filename: true } }, version: { select: { number: true } } } },
    },
  });
  return { project, pieces };
}
