import { prisma } from "@/lib/prisma";
import { ProjectStatus } from "@/lib/generated/prisma";
import { getProjectOverview } from "@/lib/project-roadmap";
import type { Profile } from "@/lib/current-user";

// Mismo cálculo que la pantalla de Inicio de la web
// (app/app/(dashboard)/page.tsx): proyecto activo más reciente con su
// progreso, contador de proyectos activos, próximo rodaje y presupuesto
// gastado en toda la organización. Se extrae aquí para que la API de la
// app móvil (app/api/mobile/dashboard/route.ts) use exactamente las
// mismas fórmulas sin copiarlas a mano.
export async function getDashboardHero(profile: Profile) {
  const organizationId = profile.organizationId;
  const now = new Date();

  const [recentProjects, activeProjectsCount, nextShootingDay, budgetCategories] =
    await Promise.all([
      prisma.project.findMany({
        where: {
          OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }],
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          status: true,
          budgetTarget: true,
          organizationId: true,
          organization: { select: { name: true } },
          createdBy: { select: { fullName: true, email: true } },
        },
      }),
      prisma.project.count({
        where: { organizationId, status: { not: ProjectStatus.FINISHED } },
      }),
      prisma.shootingDay.findFirst({
        where: { project: { organizationId }, date: { gte: now } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      prisma.budgetCategory.findMany({
        where: { project: { organizationId } },
        select: {
          items: { select: { quantity: true, unitPrice: true, taxRate: true } },
        },
      }),
    ]);

  const budgetTotal = budgetCategories.reduce((sum, category) => {
    const categoryTotal = category.items.reduce((itemSum, item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      return itemSum + quantity * unitPrice * (1 + taxRate / 100);
    }, 0);
    return sum + categoryTotal;
  }, 0);

  const heroProject = recentProjects[0] ?? null;
  const heroOverview = heroProject
    ? await getProjectOverview(
        heroProject.id,
        heroProject.budgetTarget !== null ? Number(heroProject.budgetTarget) : null,
      )
    : null;
  const heroDone = heroOverview?.steps.filter((s) => s.isDone).length ?? 0;
  const heroTotal = heroOverview?.steps.length ?? 0;
  const heroCurrent = heroOverview?.steps.find((s) => !s.isDone) ?? null;

  return {
    recentProjects,
    activeProjectsCount,
    nextShootingDay,
    budgetTotal,
    heroProject,
    heroDone,
    heroTotal,
    heroCurrentTitle: heroCurrent?.title ?? null,
  };
}
