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
  // Los pasos requeridos deciden cuándo está "listo para rodar"; los
  // recomendados mejoran el proyecto pero no bloquean nada.
  required: boolean;
  detail: string;
};

export type HealthMetric = {
  key: string;
  label: string;
  ratio: number | null;
  detail: string;
};

export type ToolStat = { text: string; tone?: "warn" | "success" };

export type NextShoot = {
  id: string;
  date: Date;
  scenesCount: number;
  hasCallSheet: boolean;
};

export type ProjectOverview = {
  steps: RoadmapStep[];
  healthMetrics: HealthMetric[];
  // Dato real en reposo para cada herramienta, indexado por su `href`
  // (ver TOOL_GROUPS) — solo aparece cuando hay algo que decir.
  toolStats: Record<string, ToolStat>;
  nextShoot: NextShoot | null;
  budget: { planned: number; actual: number; target: number | null };
};

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export async function getProjectOverview(
  projectId: string,
  budgetTarget: number | null,
): Promise<ProjectOverview> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

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
    tasksPending,
    tasksOverdue,
    documentsCount,
    scriptFilesCount,
    locationsUsed,
    vehiclesReserved,
    lastClap,
    nextShootRow,
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
      select: { quantity: true, unitPrice: true, taxRate: true, actualAmount: true },
    }),
    prisma.shot.count({ where: { scene: { projectId } } }),
    prisma.scene.count({ where: { projectId, shots: { some: {} } } }),
    prisma.shot.count({ where: { scene: { projectId }, storyboard: { some: {} } } }),
    prisma.shootingDay.findMany({
      where: { projectId },
      select: { callSheet: { select: { id: true } } },
    }),
    prisma.task.count({ where: { projectId, status: { not: "DONE" } } }),
    prisma.task.count({
      where: { projectId, status: { not: "DONE" }, dueDate: { lt: startOfToday } },
    }),
    prisma.document.count({ where: { projectId } }),
    prisma.scriptFile.count({ where: { projectId } }),
    prisma.location.count({ where: { scenes: { some: { projectId } } } }),
    prisma.vehicle.count({ where: { reservations: { some: { shootingDay: { projectId } } } } }),
    prisma.clapLog.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: { sceneNumber: true, take: true },
    }),
    prisma.shootingDay.findFirst({
      where: { projectId, date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        callSheet: { select: { id: true } },
        _count: { select: { scenes: true } },
      },
    }),
  ]);

  const budgetPlanned = budgetItems.reduce((sum, item) => {
    const subtotal = Number(item.quantity) * Number(item.unitPrice);
    return sum + subtotal * (1 + Number(item.taxRate) / 100);
  }, 0);
  const budgetActual = budgetItems.reduce(
    (sum, item) => sum + (item.actualAmount !== null ? Number(item.actualAmount) : 0),
    0,
  );

  const shootingDaysTotal = shootingDays.length;
  const shootingDaysWithCallSheet = shootingDays.filter((d) => d.callSheet).length;

  const budgetDetail = [
    budgetCategoriesCount > 0
      ? `${budgetCategoriesCount} categoría${budgetCategoriesCount === 1 ? "" : "s"} de gasto`
      : "Sin categorías todavía",
    budgetTarget !== null
      ? `${currency(budgetPlanned)} previstos de ${currency(budgetTarget)}`
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
      required: true,
      detail:
        scenesTotal > 0 ? plural(scenesTotal, "escena creada", "escenas creadas") : "Sin escenas todavía",
    },
    {
      key: "reparto",
      phase: "base",
      title: "Reparto",
      instruction: "Asigna un actor a cada personaje del guion.",
      href: `/app/${projectId}/personajes`,
      ctaLabel: "Ir a Personajes",
      isDone: charactersTotal > 0 && charactersWithActor === charactersTotal,
      required: true,
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
      required: false,
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
      required: false,
      detail:
        breakdownElementsCount > 0
          ? plural(breakdownElementsCount, "elemento catalogado", "elementos catalogados")
          : "Sin elementos todavía",
    },
    {
      key: "presupuesto",
      phase: "tecnica",
      title: "Presupuesto",
      instruction:
        "Crea las categorías de gasto y, si quieres seguimiento, define un presupuesto previsto en «Datos del proyecto».",
      href: `/app/${projectId}/presupuesto`,
      ctaLabel: "Ir a Presupuesto",
      isDone: budgetCategoriesCount > 0,
      required: true,
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
      required: true,
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
      required: false,
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
      required: false,
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
      required: true,
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
      ratio: budgetTarget ? Math.min(budgetPlanned / budgetTarget, 1) : null,
      detail: budgetTarget
        ? `${currency(budgetPlanned)} / ${currency(budgetTarget)}`
        : `${currency(budgetPlanned)} previstos`,
    },
  ];

  const toolStats: Record<string, ToolStat> = {};
  const set = (key: string, text: string, tone?: ToolStat["tone"]) => {
    toolStats[key] = { text, tone };
  };

  if (scenesTotal > 0) set("guion", plural(scenesTotal, "escena", "escenas"));
  else if (scriptFilesCount > 0) set("guion", "Guion subido · sin escenas", "warn");
  if (breakdownElementsCount > 0) set("desglose", plural(breakdownElementsCount, "elemento", "elementos"));
  if (charactersTotal > 0) {
    set(
      "personajes",
      `${charactersWithActor}/${charactersTotal} con actor`,
      charactersWithActor === charactersTotal ? "success" : undefined,
    );
  }
  if (shotsCount > 0) set("shot-list", `${plural(shotsCount, "plano", "planos")} · ${scenesWithShots}/${scenesTotal} escenas`);
  if (shotsCount > 0) set("storyboard", `${shotsWithStoryboard}/${shotsCount} planos con viñeta`);
  if (shootingDaysTotal > 0) {
    const unscheduled = scenesTotal - scenesScheduled;
    set(
      "plan-de-rodaje",
      `${plural(shootingDaysTotal, "jornada", "jornadas")}${
        unscheduled > 0 ? ` · ${unscheduled} sin día` : ""
      }`,
      unscheduled > 0 ? "warn" : undefined,
    );
    set(
      "call-sheets",
      `${shootingDaysWithCallSheet}/${shootingDaysTotal} creados`,
      shootingDaysWithCallSheet === shootingDaysTotal ? "success" : undefined,
    );
  }
  if (budgetCategoriesCount > 0) {
    set(
      "presupuesto",
      budgetTarget !== null
        ? `${currency(budgetPlanned)} previstos / ${currency(budgetTarget)}`
        : `${currency(budgetPlanned)} previstos`,
      budgetTarget !== null && budgetPlanned > budgetTarget ? "warn" : undefined,
    );
  }
  if (lastClap) set("claqueta", `Última: esc. ${lastClap.sceneNumber} · toma ${lastClap.take}`);
  if (tasksPending > 0) {
    set(
      "tareas",
      `${plural(tasksPending, "pendiente", "pendientes")}${tasksOverdue > 0 ? ` · ${tasksOverdue} vencida${tasksOverdue === 1 ? "" : "s"}` : ""}`,
      tasksOverdue > 0 ? "warn" : undefined,
    );
  }
  if (documentsCount + scriptFilesCount > 0) {
    set("documentos", plural(documentsCount + scriptFilesCount, "archivo", "archivos"));
  }
  if (locationsUsed > 0) set("localizaciones", `${locationsUsed} en uso`);
  if (vehiclesReserved > 0) set("vehiculos", `${vehiclesReserved} reservados`);

  return {
    steps,
    healthMetrics,
    toolStats,
    nextShoot: nextShootRow
      ? {
          id: nextShootRow.id,
          date: nextShootRow.date,
          scenesCount: nextShootRow._count.scenes,
          hasCallSheet: Boolean(nextShootRow.callSheet),
        }
      : null,
    budget: { planned: budgetPlanned, actual: budgetActual, target: budgetTarget },
  };
}
