import { prisma } from "@/lib/prisma";

export async function getProjectSummary(projectId: string) {
  const [project, storyboardFramesCount] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        scenes: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          include: {
            location: true,
            characters: { include: { character: true } },
            breakdownElements: { include: { breakdownElement: true } },
            _count: { select: { shots: true } },
          },
        },
        actors: { include: { characters: true } },
        characters: { include: { actor: true } },
        breakdownElements: true,
        shootingDays: {
          orderBy: { date: "asc" },
          include: {
            scenes: { orderBy: { order: "asc" }, include: { scene: true } },
            callSheet: true,
          },
        },
        budgetCategories: {
          orderBy: { order: "asc" },
          include: { items: true },
        },
      },
    }),
    prisma.storyboardFrame.count({ where: { shot: { scene: { projectId } } } }),
  ]);

  const locationsMap = new Map<string, { id: string; name: string; sceneCount: number }>();
  for (const scene of project.scenes) {
    if (!scene.location) continue;
    const existing = locationsMap.get(scene.location.id);
    if (existing) existing.sceneCount += 1;
    else
      locationsMap.set(scene.location.id, {
        id: scene.location.id,
        name: scene.location.name,
        sceneCount: 1,
      });
  }

  const shotsTotal = project.scenes.reduce((sum, scene) => sum + scene._count.shots, 0);

  const budgetCategoriesWithTotals = project.budgetCategories.map((category) => {
    const total = category.items.reduce((sum, item) => {
      const subtotal = Number(item.quantity) * Number(item.unitPrice);
      return sum + subtotal * (1 + Number(item.taxRate) / 100);
    }, 0);
    return { ...category, total };
  });
  const budgetGrandTotal = budgetCategoriesWithTotals.reduce(
    (sum, c) => sum + c.total,
    0,
  );

  return {
    project,
    locations: [...locationsMap.values()],
    shotsTotal,
    storyboardFramesCount,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
  };
}

export type ProjectSummaryData = Awaited<ReturnType<typeof getProjectSummary>>;
