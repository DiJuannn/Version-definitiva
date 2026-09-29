import { randomUUID } from "node:crypto";
import type { Role, User } from "@prisma/client";
import { db } from "@/lib/db";
import type { GuestActor, UserActor } from "@/lib/authz/actor";

export function actorOf(u: User): UserActor {
  return {
    kind: "user",
    id: u.id,
    organizationId: u.organizationId,
    role: u.role,
    name: u.name,
    email: u.email,
    clientId: u.clientId,
    canViewFinance: u.role === "ADMIN" || u.canViewFinance,
    canViewOwnPay: u.canViewOwnPay,
    sessionId: `test-${u.id}`,
  };
}

/** Crea un escenario aislado: organización, equipo, dos clientes, proyecto y pieza. */
export async function scenario() {
  const s = randomUUID().slice(0, 8);
  const org = await db.organization.create({ data: { name: `Org ${s}`, slug: `org-${s}` } });
  const mk = (role: Role, extra: Partial<User> = {}) =>
    db.user.create({ data: { organizationId: org.id, email: `${role.toLowerCase()}-${randomUUID().slice(0, 6)}-${s}@t.test`, name: `${role} ${s}`, role, passwordHash: "x", ...extra } });
  const clientA = await db.client.create({ data: { organizationId: org.id, name: `A ${s}` } });
  const clientB = await db.client.create({ data: { organizationId: org.id, name: `B ${s}` } });
  const admin = await mk("ADMIN");
  const coord = await mk("COORDINATOR");
  const coord2 = await mk("COORDINATOR");
  const editor = await mk("EDITOR");
  const editor2 = await mk("EDITOR");
  const cA = await mk("CLIENT", { clientId: clientA.id });
  const cB = await mk("CLIENT", { clientId: clientB.id });
  const project = await db.project.create({
    data: { organizationId: org.id, clientId: clientA.id, coordinatorId: coord.id, name: `P ${s}`, status: "ACTIVE", createdById: admin.id, brief: { create: { data: {} } } },
  });
  const piece = await db.piece.create({ data: { organizationId: org.id, projectId: project.id, title: `Pieza ${s}`, status: "PENDING_ASSIGNMENT" } });
  const other = await db.organization.create({ data: { name: `Otra ${s}`, slug: `otra-${s}` } });
  const foreignAdmin = await db.user.create({ data: { organizationId: other.id, email: `fa-${s}@t.test`, name: "Ajeno", role: "ADMIN", passwordHash: "x" } });
  return {
    org,
    clientA,
    clientB,
    project,
    piece,
    admin: actorOf(admin),
    coord: actorOf(coord),
    coord2: actorOf(coord2),
    editor: actorOf(editor),
    editor2: actorOf(editor2),
    cA: actorOf(cA),
    cB: actorOf(cB),
    foreign: actorOf(foreignAdmin),
  };
}

/** Archivo de revisión "subido" (sin pasar por el disco) listo para crear versión. */
export async function readyPreview(orgId: string, pieceId: string, createdById: string) {
  return db.mediaAsset.create({
    data: { organizationId: orgId, kind: "PREVIEW", provider: "LOCAL", filename: "v.webm", mimeType: "video/webm", status: "READY", pieceId, createdById, storageKey: `x/${randomUUID()}` },
  });
}

export function guestFor(link: { id: string; organizationId: string; scope: "PROJECT" | "PIECE" | "VERSION"; projectId: string; pieceId: string | null; versionId: string | null; canComment: boolean; canApprove: boolean; canDownload: boolean }, guestId: string): GuestActor {
  return {
    kind: "guest",
    id: guestId,
    organizationId: link.organizationId,
    name: "Invitado",
    email: "inv@t.test",
    link: { id: link.id, scope: link.scope, projectId: link.projectId, pieceId: link.pieceId, versionId: link.versionId, canComment: link.canComment, canApprove: link.canApprove, canDownload: link.canDownload },
  };
}
