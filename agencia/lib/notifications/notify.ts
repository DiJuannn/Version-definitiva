import "server-only";
import type { Tx } from "@/lib/db";
import { env } from "@/lib/env";
import type { NotificationType } from "./types";

export type NotifyInput = {
  organizationId: string;
  type: NotificationType;
  recipients: string[];
  title: string;
  body?: string;
  url?: string;
  // Avisos con la misma clave sin leer se agrupan (se incrementa el contador).
  groupKey: string;
  // Identificador único del evento: impide emails duplicados si se reintenta.
  eventKey: string;
  // true = contenido interno: nunca se entrega a usuarios CLIENT.
  internal: boolean;
  excludeUserId?: string | null;
};

/**
 * Crea avisos en la app y encola emails respetando preferencias y alcance.
 * Debe llamarse dentro de la transacción de la acción que lo origina.
 */
export async function notify(tx: Tx, input: NotifyInput) {
  const ids = [...new Set(input.recipients)].filter((id) => id && id !== input.excludeUserId);
  if (!ids.length) return;
  const users = await tx.user.findMany({
    where: {
      id: { in: ids },
      organizationId: input.organizationId,
      active: true,
      ...(input.internal ? { role: { not: "CLIENT" } } : {}),
    },
    select: { id: true, email: true, notificationPrefs: { where: { type: input.type } } },
  });

  for (const u of users) {
    const pref = u.notificationPrefs[0];
    if (pref?.inApp !== false) {
      const existing = await tx.notification.findFirst({
        where: { userId: u.id, groupKey: input.groupKey, readAt: null },
        select: { id: true },
      });
      if (existing) {
        await tx.notification.update({
          where: { id: existing.id },
          data: { count: { increment: 1 }, title: input.title, body: input.body, url: input.url },
        });
      } else {
        await tx.notification.create({
          data: {
            organizationId: input.organizationId,
            userId: u.id,
            type: input.type,
            title: input.title,
            body: input.body,
            url: input.url,
            groupKey: input.groupKey,
          },
        });
      }
    }
    if (pref?.email !== false) {
      const link = input.url ? `${env().APP_URL}${input.url}` : env().APP_URL;
      await tx.emailOutbox.createMany({
        data: [
          {
            organizationId: input.organizationId,
            idempotencyKey: `${input.eventKey}:${u.id}`,
            to: u.email,
            subject: input.title,
            body: `${input.body ?? input.title}\n\nAbrir: ${link}`,
          },
        ],
        skipDuplicates: true,
      });
    }
  }
}
