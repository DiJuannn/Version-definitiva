import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/plan";

// El plan que manda para las funciones de un proyecto es el de la
// organización DUEÑA de ese proyecto (project.organizationId) — no el
// de quien lo está viendo, que puede pertenecer a otra organización con
// acceso solo por un enlace compartido (ver ProjectShare). Es la
// organización dueña la que paga (o no) el plan PRO.
export async function isProjectOwnerPro(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return org ? isPro(org.plan) : false;
}
