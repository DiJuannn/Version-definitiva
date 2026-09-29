import "server-only";
import type { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/authz/actor";

/**
 * Personas que pueden participar (y ser mencionadas) en la conversación de una
 * versión. Para conversación interna solo equipo de la agencia en el ámbito del
 * proyecto; para la del cliente, además los usuarios del cliente.
 * Los invitados no reciben la lista de emails del equipo.
 */
export async function reviewParticipants(
  a: Actor,
  version: { piece: { editorId: string | null; project: { coordinatorId: string | null; clientId: string; organizationId: string } } },
  visibility: Visibility,
) {
  const p = version.piece.project;
  const ids = [version.piece.editorId, p.coordinatorId].filter(Boolean) as string[];
  const users = await db.user.findMany({
    where: {
      organizationId: p.organizationId,
      active: true,
      OR: [
        { id: { in: ids } },
        { role: "ADMIN" },
        ...(visibility === "CLIENT" ? [{ role: "CLIENT" as const, clientId: p.clientId }] : []),
      ],
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return a.kind === "guest" ? users.filter((u) => u.role !== "ADMIN") : users;
}
