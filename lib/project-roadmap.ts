import { prisma } from "@/lib/prisma";

export type RoadmapPhase = "base" | "tecnica" | "rodaje";

export type RoadmapStep = {
  key: string;
  phase: RoadmapPhase;
  title: string;
  instruction: string;
  href: string;
  ctaLabel: string;
  isDone: boolean;
  detail: string;
};

export type HealthMetric = {
  key: string;
  label: string;
  ratio: number | null;
  detail: string;
};

export type ProjectOverview = {
  steps: RoadmapStep[];
  healthMetrics: HealthMetric[];
};

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export async function getProjectOverview(
  projectId: string,
  budgetTarget: number | null,
): Promise<ProjectOverview> {
  const [
    scenesTotal,
    scenesWithLocation,
    scenesScheduled,
    charactersTotal,
    charactersWithActor,
    breakdownElementsCount,
    budgetCategoriesCount,
    budgetItems,
    shotsCount,
    scenesWithShots,
    shotsWithStoryboard,
    shootingDays,
  ] = await Promise.all([
    prisma.scene.count({ where: { projectId } }),
    prisma.scene.count({ where: { projectId, locationId: { not: null } } }),
    prisma.scene.count({ where: { projectId, shootingDayScenes: { some: {} } } }),
    prisma.character.count({ where: { projectId } }),
    prisma.character.count({ where: { projectId, actorId: { not: null } } }),
    prisma.breakdownElement.count({ where: { projectId } }),
    prisma.budgetCategory.count({ where: { projectId } }),
    prisma.budgetItem.findMany({
      where: { category: { projectId } },
      select: { quantity: true, unitPrice: true, taxRate: true },
    }),
    prisma.shot.count({ where: { scene: { projectId } } }),
    prisma.scene.count({ where: { projectId, shots: { some: {} } } }),
    prisma.shot.count({ where: { scene: { projectId }, storyboard: { some: {} } } }),
    prisma.shootingDay.findMany({
      where: { projectId },
      select: { callSheet: { select: { id: true } } },
    }),
  ]);

  const budgetSpent = budgetItems.reduce((sum, item) => {
    const subtotal = Number(item.quantity) * Number(item.unitPrice);
    return sum + subtotal * (1 + Number(item.taxRate) / 100);
  }, 0);

  const shootingDaysTotal = shootingDays.length;
  const shootingDaysWithCallSheet = shootingDays.filter((d) => d.callSheet).length;

  const budgetDetail = [
    budgetCategoriesCount > 0
      ? `${budgetCategoriesCount} categoría${budgetCategoriesCount === 1 ? "" : "s"} de gasto`
      : "Sin categorías todavía",
    budgetTarget !== null
      ? `${currency(budgetSpent)} de ${currency(budgetTarget)} previstos`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const steps: RoadmapStep[] = [
    {
      key: "guion",
      phase: "base",
      title: "Guion y escenas",
      instruction:
        "Sube el guion (o crea las escenas a mano) para tener la base de todo el proyecto.",
      href: `/app/${projectId}/guion`,
      ctaLabel: "Ir a Guion",
      isDone: scenesTotal > 0,
      detail:
        scenesTotal > 0 ? `${scenesTotal} escena(s) creada(s)` : "Sin escenas todavía",
    },
    {
      key: "reparto",
      phase: "base",
      title: "Reparto",
      instruction: "Asigna un actor a cada personaje del guion.",
      href: `/app/${projectId}/personajes`,
      ctaLabel: "Ir a Personajes",
      isDone: charactersTotal > 0 && charactersWithActor === charactersTotal,
      detail:
        charactersTotal > 0
          ? `${charactersWithActor}/${charactersTotal} personajes con actor`
          : "Sin personajes todavía",
    },
    {
      key: "localizaciones",
      phase: "base",
      title: "Localizaciones",
      instruction: "Asigna una localización a cada escena.",
      href: `/app/${projectId}/guion`,
      ctaLabel: "Ir a Guion",
      isDone: scenesTotal > 0 && scenesWithLocation === scenesTotal,
      detail:
        scenesTotal > 0
          ? `${scenesWithLocation}/${scenesTotal} escenas con localización`
          : "Añade escenas primero",
    },
    {
      key: "desglose",
      phase: "tecnica",
      title: "Desglose",
      instruction: "Cataloga atrezzo, vestuario y equipo necesario por escena.",
      href: `/app/${projectId}/desglose`,
      ctaLabel: "Ir a Desglose",
      isDone: breakdownElementsCount > 0,
      detail:
        breakdownElementsCount > 0
          ? `${breakdownElementsCount} elemento(s) catalogados`
          : "Sin elementos todavía",
    },
    {
      key: "presupuesto",
      phase: "tecnica",
      title: "Presupuesto",
      instruction:
        "Crea las categorías de gasto y, si quieres seguimiento, define un presupuesto previsto en “Editar”.",
      href: `/app/${projectId}/presupuesto`,
      ctaLabel: "Ir a Presupuesto",
      isDone: budgetCategoriesCount > 0,
      detail: budgetDetail,
    },
    {
      key: "plan-de-rodaje",
      phase: "tecnica",
      title: "Plan de rodaje",
      instruction: "Agrupa las escenas en días de rodaje concretos.",
      href: `/app/${projectId}/plan-de-rodaje`,
      ctaLabel: "Ir a Plan de rodaje",
      isDone: scenesTotal > 0 && scenesScheduled === scenesTotal,
      detail:
        scenesTotal > 0
          ? `${scenesScheduled}/${scenesTotal} escenas programadas`
          : "Añade escenas primero",
    },
    {
      key: "shot-list",
      phase: "rodaje",
      title: "Shot list",
      instruction: "Define al menos un plano en cada escena.",
      href: `/app/${projectId}/shot-list`,
      ctaLabel: "Ir a Shot list",
      isDone: scenesTotal > 0 && scenesWithShots === scenesTotal,
      detail:
        scenesTotal > 0
          ? `${scenesWithShots}/${scenesTotal} escenas con planos`
          : "Añade escenas primero",
    },
    {
      key: "storyboard",
      phase: "rodaje",
      title: "Storyboard",
      instruction: "Dibuja o sube una viñeta para cada plano definido.",
      href: `/app/${projectId}/storyboard`,
      ctaLabel: "Ir a Storyboard",
      isDone: shotsCount > 0 && shotsWithStoryboard === shotsCount,
      detail:
        shotsCount > 0
          ? `${shotsWithStoryboard}/${shotsCount} planos con viñeta`
          : "Define los planos primero",
    },
    {
      key: "call-sheets",
      phase: "rodaje",
      title: "Call sheets",
      instruction: "Genera la hoja de convocatoria de cada día de rodaje.",
      href: `/app/${projectId}/call-sheets`,
      ctaLabel: "Ir a Call sheets",
      isDone: shootingDaysTotal > 0 && shootingDaysWithCallSheet === shootingDaysTotal,
      detail:
        shootingDaysTotal > 0
          ? `${shootingDaysWithCallSheet}/${shootingDaysTotal} días con hoja de convocatoria`
          : "Planifica los días de rodaje primero",
    },
  ];

  const healthMetrics: HealthMetric[] = [
    {
      key: "locations",
      label: "Localizaciones",
      ratio: scenesTotal > 0 ? scenesWithLocation / scenesTotal : null,
      detail: scenesTotal > 0 ? `${scenesWithLocation}/${scenesTotal}` : "sin datos",
    },
    {
      key: "cast",
      label: "Reparto",
      ratio: charactersTotal > 0 ? charactersWithActor / charactersTotal : null,
      detail: charactersTotal > 0 ? `${charactersWithActor}/${charactersTotal}` : "sin datos",
    },
    {
      key: "schedule",
      label: "Plan de rodaje",
      ratio: scenesTotal > 0 ? scenesScheduled / scenesTotal : null,
      detail: scenesTotal > 0 ? `${scenesScheduled}/${scenesTotal}` : "sin datos",
    },
    {
      key: "budget",
      label: "Presupuesto",
      ratio: budgetTarget ? Math.min(budgetSpent / budgetTarget, 1) : null,
      detail: budgetTarget
        ? `${currency(budgetSpent)} / ${currency(budgetTarget)}`
        : `${currency(budgetSpent)} gastado`,
    },
  ];

  return { steps, healthMetrics };
}
