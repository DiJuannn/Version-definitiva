import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { GuestActor } from "@/lib/authz/actor";
import { sha256 } from "./crypto";

export const guestCookieName = (shareLinkId: string) => `corte_g_${shareLinkId}`;

export function isLinkUsable(link: { revokedAt: Date | null; expiresAt: Date | null }, now = new Date()) {
  return !link.revokedAt && (!link.expiresAt || link.expiresAt > now);
}

/** Invitado identificado para un enlace concreto (cookie propia por enlace). */
export async function getGuestActor(shareLinkId: string): Promise<GuestActor | null> {
  const jar = await cookies();
  const token = jar.get(guestCookieName(shareLinkId))?.value;
  if (!token) return null;
  const guest = await db.reviewGuest.findUnique({
    where: { sessionTokenHash: sha256(token) },
    include: { shareLink: true },
  });
  if (!guest || guest.shareLinkId !== shareLinkId || !isLinkUsable(guest.shareLink)) return null;
  const l = guest.shareLink;
  return {
    kind: "guest",
    id: guest.id,
    organizationId: l.organizationId,
    name: guest.name,
    email: guest.email,
    link: {
      id: l.id,
      scope: l.scope,
      projectId: l.projectId,
      pieceId: l.pieceId,
      versionId: l.versionId,
      canComment: l.canComment,
      canApprove: l.canApprove,
      canDownload: l.canDownload,
    },
  };
}
