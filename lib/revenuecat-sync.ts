import { prisma } from "@/lib/prisma";
import { decidePlanChange, fetchProEntitlement } from "@/lib/revenuecat";
import type { OrganizationPlan } from "@/lib/generated/prisma";

export type SyncResult = {
  found: boolean;
  from?: OrganizationPlan;
  to?: OrganizationPlan;
  changed: boolean;
  active?: boolean;
};

// Consulta a RevenueCat cómo está el derecho PRO de una organización y le
// aplica el plan que corresponda. Lo usan dos sitios: el webhook (cuando
// RevenueCat avisa) y el botón de la app tras comprar o restaurar (para no
// depender de que el aviso llegue justo a tiempo).
export async function syncOrganizationPlan(organizationId: string): Promise<SyncResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, lemonSqueezySubscriptionId: true },
  });
  if (!org) return { found: false, changed: false };

  const state = await fetchProEntitlement(organizationId);
  const next = decidePlanChange(org, state);
  if (next) {
    await prisma.organization.update({ where: { id: organizationId }, data: { plan: next } });
  }
  return {
    found: true,
    from: org.plan,
    to: next ?? org.plan,
    changed: next !== null,
    active: state.active,
  };
}
