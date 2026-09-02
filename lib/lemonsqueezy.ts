import { createHmac, timingSafeEqual } from "crypto";

// Los enlaces de checkout se pegan tal cual desde Lemon Squeezy (Store >
// Products > variante > "Copy checkout URL") — no hace falta construirlos a
// mano. Si las dos suscripciones no están configuradas todavía, la sección
// de precios se oculta sola en vez de mostrar un botón roto. El pago único
// (lifetime) es opcional aparte: puede activarse más tarde sin tocar nada
// de las suscripciones.
export function getCheckoutUrls() {
  const monthly = process.env.LEMONSQUEEZY_CHECKOUT_URL_MONTHLY;
  const yearly = process.env.LEMONSQUEEZY_CHECKOUT_URL_YEARLY;
  if (!monthly || !yearly) return null;
  const lifetime = process.env.LEMONSQUEEZY_CHECKOUT_URL_LIFETIME ?? null;
  return { monthly, yearly, lifetime };
}

// Añade el email y el id de la organización al enlace de checkout — Lemon
// Squeezy los devuelve tal cual en el webhook (meta.custom_data), que es
// como sabemos a qué organización activarle el plan PRO.
export function buildCheckoutUrl(
  baseUrl: string,
  organizationId: string,
  email: string,
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("checkout[email]", email);
  url.searchParams.set("checkout[custom][organization_id]", organizationId);
  return url.toString();
}

// Lemon Squeezy firma cada webhook con HMAC-SHA256 sobre el cuerpo crudo de
// la petición — hay que comparar contra el secreto configurado en su panel
// (Settings > Webhooks) antes de fiarse de nada del contenido.
export function verifyLemonSqueezySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

// Solo estos estados de suscripción cuentan como "PRO activo" — el resto
// (cancelled, expired, unpaid, past_due...) hace que el plan vuelva a FREE.
export function isActiveSubscriptionStatus(status: string): boolean {
  return status === "active" || status === "on_trial";
}
