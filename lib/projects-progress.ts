import { prisma } from "@/lib/prisma";

export type ProjectProgress = { done: number; total: number };

// Versión ligera de los 5 pasos REQUERIDOS de la Hoja de ruta
// (lib/project-roadmap.ts) para varios proyectos a la vez, con una consulta
// agrupada por tabla en vez de ~20 por proyecto — solo para pintar una barra
// de progreso en el dashboard y el listado. Los criterios deben coincidir
// con los pasos con `required: true` de getProjectOverview.
export async function getProjectsProgress(
  projectIds: string[],
): Promise<Record<string, ProjectProgress>> {
  if (projectIds.length === 0) return {};
  const inProjects = { in: projectIds };

  const [scenes, scheduled, characters, charactersWithActor, budgets, days, daysWithSheet] =
    await Promise.all([
      prisma.scene.groupBy({ by: ["projectId"], where: { projectId: inProjects }, _count: { _all: true } }),
      prisma.scene.groupBy({
        by: ["projectId"],
        where: { projectId: inProjects, shootingDayScenes: { some: {} } },
        _count: { _all: true },
      }),
      prisma.character.groupBy({ by: ["projectId"], where: { projectId: inProjects }, _count: { _all: true } }),
      prisma.character.groupBy({
        by: ["projectId"],
        where: { projectId: inProjects, actorId: { not: null } },
        _count: { _all: true },
      }),
      prisma.budgetCategory.groupBy({ by: ["projectId"], where: { projectId: inProjects }, _count: { _all: true } }),
      prisma.shootingDay.groupBy({ by: ["projectId"], where: { projectId: inProjects }, _count: { _all: true } }),
      prisma.shootingDay.groupBy({
        by: ["projectId"],
        where: { projectId: inProjects, callSheet: { isNot: null } },
        _count: { _all: true },
      }),
    ]);

  const toMap = (rows: { projectId: string; _count: { _all: number } }[]) =>
    new Map(rows.map((r) => [r.projectId, r._count._all]));
  const sceneN = toMap(scenes);
  const scheduledN = toMap(scheduled);
  const charN = toMap(characters);
  const charActorN = toMap(charactersWithActor);
  const budgetN = toMap(budgets);
  const dayN = toMap(days);
  const daySheetN = toMap(daysWithSheet);

  const result: Record<string, ProjectProgress> = {};
  for (const id of projectIds) {
    const s = sceneN.get(id) ?? 0;
    const c = charN.get(id) ?? 0;
    const d = dayN.get(id) ?? 0;
    const flags = [
      s > 0,
      c > 0 && (charActorN.get(id) ?? 0) === c,
      (budgetN.get(id) ?? 0) > 0,
      s > 0 && (scheduledN.get(id) ?? 0) === s,
      d > 0 && (daySheetN.get(id) ?? 0) === d,
    ];
    result[id] = { done: flags.filter(Boolean).length, total: flags.length };
  }
  return result;
}
