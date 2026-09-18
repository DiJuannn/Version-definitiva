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
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [recentProjects, lastVisitedProject, activeProjectsCount, nextShootingDay, budgetCategories] =
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
      // Igual que en la web: "Continuar" sigue al último proyecto que
      // esta persona visitó de verdad (se actualiza en
      // getProjectForProfile), no al que más recientemente se editó —
      // si no ha visitado ninguno, o el que visitó ya no es accesible,
      // se cae al de más abajo.
      profile.lastVisitedProjectId
        ? prisma.project.findFirst({
            where: {
              id: profile.lastVisitedProjectId,
              OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }],
            },
            select: {
              id: true,
              name: true,
              status: true,
              budgetTarget: true,
              organizationId: true,
              organization: { select: { name: true } },
              createdBy: { select: { fullName: true, email: true } },
            },
          })
        : Promise.resolve(null),
      prisma.project.count({
        where: { organizationId, status: { not: ProjectStatus.FINISHED } },
      }),
      prisma.shootingDay.findFirst({
        where: { project: { organizationId }, date: { gte: startOfToday } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          projectId: true,
          project: { select: { name: true } },
          callSheet: { select: { id: true } },
          _count: { select: { scenes: true } },
        },
      }),
      prisma.budgetCategory.findMany({
        where: { project: { organizationId } },
        select: {
          items: { select: { quantity: true, unitPrice: true, taxRate: true, actualAmount: true } },
        },
      }),
    ]);

  let budgetTotal = 0;
  let budgetActual = 0;
  for (const category of budgetCategories) {
    for (const item of category.items) {
      budgetTotal += Number(item.quantity) * Number(item.unitPrice) * (1 + Number(item.taxRate) / 100);
      if (item.actualAmount !== null) budgetActual += Number(item.actualAmount);
    }
  }

  const heroProject = lastVisitedProject ?? recentProjects[0] ?? null;
  const heroOverview = heroProject
    ? await getProjectOverview(
        heroProject.id,
        heroProject.budgetTarget !== null ? Number(heroProject.budgetTarget) : null,
      )
    : null;
  // El progreso cuenta solo los pasos requeridos (los opcionales no bloquean
  // "listo para rodar"), igual que en la web.
  const heroRequired = heroOverview?.steps.filter((s) => s.required) ?? [];
  const heroDone = heroRequired.filter((s) => s.isDone).length;
  const heroTotal = heroRequired.length;
  const heroCurrent = heroRequired.find((s) => !s.isDone) ?? null;

  return {
    recentProjects,
    activeProjectsCount,
    nextShootingDay,
    budgetTotal,
    budgetActual,
    heroProject,
    heroDone,
    heroTotal,
    heroCurrentTitle: heroCurrent?.title ?? null,
  };
}
