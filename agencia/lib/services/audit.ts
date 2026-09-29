import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";
import { actorLabel, type Actor } from "@/lib/authz/actor";

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  clientVisible?: boolean;
  data?: Prisma.InputJsonValue;
};

/** Registro de auditoría append-only. Llamar dentro de la misma transacción. */
export async function audit(tx: Tx, actor: Actor | { system: true; organizationId: string }, e: AuditEntry) {
  const isSystem = "system" in actor;
  await tx.auditLog.create({
    data: {
      organizationId: actor.organizationId,
      actorUserId: !isSystem && actor.kind === "user" ? actor.id : null,
      actorGuestId: !isSystem && actor.kind === "guest" ? actor.id : null,
      actorLabel: isSystem ? "Sistema" : actorLabel(actor),
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      projectId: e.projectId ?? null,
      clientVisible: e.clientVisible ?? false,
      data: e.data,
    },
  });
}
