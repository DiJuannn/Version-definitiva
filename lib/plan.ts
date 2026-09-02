import type { OrganizationPlan } from "@/lib/generated/prisma";

// Punto único de "¿esta organización es de pago?" — PRO (suscripción) y
// PRO_LIFETIME (pago único) se tratan exactamente igual en todas partes,
// incluidos los límites y el texto "PRO" que se le enseña al usuario.
// Solo el webhook de Lemon Squeezy distingue entre los dos, porque ahí sí
// importa (una cancelación de suscripción nunca debe tocar un pago único).
export function isPro(plan: OrganizationPlan): boolean {
  return plan === "PRO" || plan === "PRO_LIFETIME";
}

// Filtro listo para usar en consultas de Prisma (where: { plan: { in: PRO_PLANS } }).
export const PRO_PLANS: OrganizationPlan[] = ["PRO", "PRO_LIFETIME"];
