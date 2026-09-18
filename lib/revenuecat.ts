import { timingSafeEqual } from "node:crypto";
import type { OrganizationPlan } from "@/lib/generated/prisma";

// Integración con RevenueCat (compras dentro de la app móvil: Google Play y,
// más adelante, App Store). El id de usuario de RevenueCat ES el id de la
// organización (la app hace Purchases.logIn(organizationId)), así que el aviso
// dice directamente a qué organización activarle o quitarle el plan PRO.

// Nombre del "entitlement" en RevenueCat que representa el plan PRO. Si se
// renombra en su panel, cambiarlo aquí.
export const PRO_ENTITLEMENT = "pro";

const API_BASE = "https://api.revenuecat.com/v1";

// El aviso trae una clave que se configura a mano en el panel de RevenueCat
// (Integrations → Webhooks → Authorization header) y en REVENUECAT_WEBHOOK_AUTH.
export function isValidWebhookAuth(header: string | null): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isRevenueCatConfigured(): boolean {
  return Boolean(process.env.REVENUECAT_WEBHOOK_AUTH && process.env.REVENUECAT_SECRET_KEY);
}

export type ProEntitlementState = {
  active: boolean;
  // Sin fecha de fin = pago único de por vida.
  lifetime: boolean;
};

type RcEntitlement = {
  expires_date: string | null;
  grace_period_expires_date?: string | null;
};

// Estado actual del derecho PRO según la API de RevenueCat. No se fía del
// contenido del aviso (puede llegar duplicado o desordenado): el aviso solo
// sirve de disparador y aquí se pregunta cómo está el usuario ahora mismo.
export async function fetchProEntitlement(appUserId: string): Promise<ProEntitlementState> {
  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret) throw new Error("Falta REVENUECAT_SECRET_KEY");

  const response = await fetch(`${API_BASE}/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`RevenueCat respondió ${response.status}`);
  }
  const body = (await response.json()) as {
    subscriber?: { entitlements?: Record<string, RcEntitlement> };
  };
  return entitlementState(body.subscriber?.entitlements?.[PRO_ENTITLEMENT], new Date());
}

export function entitlementState(
  entitlement: RcEntitlement | undefined,
  now: Date,
): ProEntitlementState {
  if (!entitlement) return { active: false, lifetime: false };
  if (entitlement.expires_date === null) return { active: true, lifetime: true };
  const end = Math.max(
    new Date(entitlement.expires_date).getTime(),
    entitlement.grace_period_expires_date
      ? new Date(entitlement.grace_period_expires_date).getTime()
      : 0,
  );
  return { active: end > now.getTime(), lifetime: false };
}

// Qué plan debe tener la organización dado el estado en RevenueCat; null =
// dejarlo como está. Reglas de prudencia, porque el plan también puede venir
// de Lemon Squeezy (web):
// - un pago único (PRO_LIFETIME) nunca se degrada por un aviso de suscripción;
// - una suscripción con id de Lemon Squeezy no se quita desde aquí, la gestiona
//   su propio webhook;
// - solo se quita PRO si RevenueCat dice que el derecho ya no está activo.
export function decidePlanChange(
  current: { plan: OrganizationPlan; lemonSqueezySubscriptionId: string | null },
  state: ProEntitlementState,
): OrganizationPlan | null {
  if (state.active) {
    if (state.lifetime) return current.plan === "PRO_LIFETIME" ? null : "PRO_LIFETIME";
    return current.plan === "FREE" ? "PRO" : null;
  }
  if (current.plan === "PRO" && !current.lemonSqueezySubscriptionId) return "FREE";
  return null;
}
