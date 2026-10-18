import type { OrganizationPlan } from "@/lib/generated/prisma";

// Punto único de "¿esta organización es de pago?" — PRO (suscripción) y
// PRO_LIFETIME (pago único) se tratan exactamente igual en todas partes,
// incluidos los límites y el texto "PRO" que se le enseña al usuario.
// Solo el webhook de Lemon Squeezy distingue entre los dos, porque ahí sí
// importa (una cancelación de suscripción nunca debe tocar un pago único).
// Acceso total temporal: mientras sea true, TODO el mundo tiene todas las
// funciones de PRO (isPro devuelve true para cualquier plan). Los planes de
// pago, el webhook y los datos no se tocan: al volver a false, cada
// organización recupera su plan real. Para decidir más adelante qué funciones
// son de PRO, basta con volver a ponerlo en false y ajustar los límites.
export const ALL_ACCESS = true;

// ¿Paga de verdad? (sin el acceso total). Solo para métricas y facturación.
export function isPaidPlan(plan: OrganizationPlan): boolean {
  return plan === "PRO" || plan === "PRO_LIFETIME";
}

export function isPro(plan: OrganizationPlan): boolean {
  return ALL_ACCESS || isPaidPlan(plan);
}

// Filtro listo para usar en consultas de Prisma (where: { plan: { in: PRO_PLANS } }).
export const PRO_PLANS: OrganizationPlan[] = ["PRO", "PRO_LIFETIME"];
