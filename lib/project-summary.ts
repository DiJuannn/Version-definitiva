import { prisma } from "@/lib/prisma";

export async function getProjectSummary(projectId: string) {
  const [project, storyboardFramesCount, shotsWithFrames, itemReservations, vehicleReservations] =
    await Promise.all([
      prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        include: {
          scenes: {
            orderBy: [{ order: "asc" }, { number: "asc" }],
            include: {
              location: true,
              characters: { include: { character: true } },
              breakdownElements: { include: { breakdownElement: true } },
              crewMembers: { include: { crewMember: true } },
              _count: { select: { shots: true, shootingDayScenes: true } },
            },
          },
          actors: { include: { characters: true } },
          characters: { include: { actor: true } },
          breakdownElements: true,
          crewMembers: true,
          shootingDays: {
            orderBy: { date: "asc" },
            include: {
              scenes: { orderBy: { order: "asc" }, include: { scene: true } },
              shots: { select: { id: true, done: true } },
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
      prisma.shot.count({ where: { scene: { projectId }, storyboard: { some: {} } } }),
      // Reservas por día de rodaje — Inventario y Vehículos son flotas de
      // toda la organización (ver app/app/(dashboard)/inventario y
      // vehiculos), esto solo trae las reservas de ESTE proyecto, para
      // saber qué llevar cada día de rodaje y en total.
      prisma.itemReservation.findMany({
        where: { shootingDay: { projectId } },
        include: { inventoryItem: true },
      }),
      prisma.vehicleReservation.findMany({
        where: { shootingDay: { projectId } },
        include: { vehicle: true },
      }),
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
    // Gasto real anotado por partida (BudgetItem.actualAmount); las partidas
    // sin anotar no cuentan como 0 gastado, simplemente no suman.
    const actual = category.items.reduce(
      (sum, item) => sum + (item.actualAmount !== null ? Number(item.actualAmount) : 0),
      0,
    );
    return { ...category, total, actual };
  });
  const budgetGrandTotal = budgetCategoriesWithTotals.reduce(
    (sum, c) => sum + c.total,
    0,
  );

  const budgetGrandActual = budgetCategoriesWithTotals.reduce((sum, c) => sum + c.actual, 0);
  const hasBudgetActual = project.budgetCategories.some((c) =>
    c.items.some((item) => item.actualAmount !== null),
  );

  // Agregados de toda la producción: mismo objeto (por id) sumando la
  // cantidad/los días reservados en cualquier jornada de este proyecto.
  const itemsMap = new Map<
    string,
    { id: string; name: string; category: string; quantity: number; daysCount: number }
  >();
  for (const reservation of itemReservations) {
    const existing = itemsMap.get(reservation.inventoryItem.id);
    if (existing) {
      existing.quantity += reservation.quantity;
      existing.daysCount += 1;
    } else {
      itemsMap.set(reservation.inventoryItem.id, {
        id: reservation.inventoryItem.id,
        name: reservation.inventoryItem.name,
        category: reservation.inventoryItem.category,
        quantity: reservation.quantity,
        daysCount: 1,
      });
    }
  }

  const vehiclesMap = new Map<
    string,
    { id: string; name: string; type: string | null; plate: string | null; daysCount: number }
  >();
  for (const reservation of vehicleReservations) {
    const existing = vehiclesMap.get(reservation.vehicle.id);
    if (existing) existing.daysCount += 1;
    else
      vehiclesMap.set(reservation.vehicle.id, {
        id: reservation.vehicle.id,
        name: reservation.vehicle.name,
        type: reservation.vehicle.type,
        plate: reservation.vehicle.plate,
        daysCount: 1,
      });
  }

  // Lo que hace falta llevar cada día concreto de rodaje: escenas (ya
  // venían), más el equipo técnico de esas escenas y lo reservado ese
  // día en concreto — misma idea que ya calcula la propia página del
  // día (plan-de-rodaje/[dayId]), reutilizada aquí para el Resumen y el
  // dossier en vez de recalcularla por su cuenta.
  const shootingDaysWithNeeds = project.shootingDays.map((day) => {
    const crewIds = new Set<string>();
    const crewNames: string[] = [];
    // day.scenes solo trae `scene: true` (sin las relaciones anidadas de
    // la escena) — el equipo técnico se resuelve a partir del listado ya
    // cargado de escenas del proyecto (project.scenes), que sí las trae.
    const sceneIdsForDay = new Set(day.scenes.map((a) => a.sceneId));
    for (const scene of project.scenes) {
      if (!sceneIdsForDay.has(scene.id)) continue;
      for (const sc of scene.crewMembers) {
        if (crewIds.has(sc.crewMemberId)) continue;
        crewIds.add(sc.crewMemberId);
        crewNames.push(sc.crewMember.name);
      }
    }

    const dayItems = itemReservations
      .filter((r) => r.shootingDayId === day.id)
      .map((r) => `${r.inventoryItem.name}${r.quantity > 1 ? ` (x${r.quantity})` : ""}`);
    const dayVehicles = vehicleReservations
      .filter((r) => r.shootingDayId === day.id)
      .map((r) => r.vehicle.name);

    return { ...day, crewNames, itemNames: dayItems, vehicleNames: dayVehicles };
  });

  return {
    project,
    locations: [...locationsMap.values()],
    shotsTotal,
    storyboardFramesCount,
    shotsWithFrames,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
    budgetGrandActual,
    hasBudgetActual,
    inventoryItems: [...itemsMap.values()],
    vehicles: [...vehiclesMap.values()],
    shootingDaysWithNeeds,
  };
}

export type ProjectSummaryData = Awaited<ReturnType<typeof getProjectSummary>>;

// ---------------------------------------------------------------------------
// Lo importante del proyecto, ya digerido: se usa igual en el Resumen de la web
// y en el de la app (que lo recibe serializado desde la API móvil).
// ---------------------------------------------------------------------------

// Herramienta a la que lleva cada enlace: coincide con la ruta de la web
// (/app/<proyecto>/<slug>) y con la pantalla equivalente de la app (/<slug>).
export type SummaryTool =
  | "guion"
  | "personajes"
  | "localizaciones"
  | "shot-list"
  | "storyboard"
  | "plan-de-rodaje"
  | "call-sheets"
  | "presupuesto";

export type SummaryProgress = {
  key: string;
  label: string;
  done: number;
  total: number;
  // Frase corta que explica qué cuenta la barra.
  hint: string;
  tool: SummaryTool;
};

export type SummaryPending = { text: string; tool: SummaryTool };

export type NextShoot = {
  dayId: string;
  date: Date;
  daysUntil: number;
  scenes: number;
  shots: number;
  locationNames: string[];
  callTime: string | null;
  hasCallSheet: boolean;
};

export type ProjectHighlights = {
  nextShoot: NextShoot | null;
  // Todos los días de rodaje: primero, último, cuántos ya pasaron.
  span: { first: Date; last: Date; total: number; past: number } | null;
  shots: { total: number; planned: number; done: number };
  budget: { total: number; actual: number; target: number | null; hasActual: boolean };
  progress: SummaryProgress[];
  pending: SummaryPending[];
};

// Fecha de hoy en España como "AAAA-MM-DD" (el servidor va en UTC).
function madridToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function buildProjectHighlights(
  data: ProjectSummaryData,
  now: Date = new Date(),
): ProjectHighlights {
  const { project, shootingDaysWithNeeds: days } = data;
  const scenesTotal = project.scenes.length;
  const today = dayNumber(madridToday(now));
  const dayOf = (date: Date) => dayNumber(date.toISOString().slice(0, 10));

  const scenesWithLocation = project.scenes.filter((sc) => sc.locationId).length;
  const scenesWithShots = project.scenes.filter((sc) => sc._count.shots > 0).length;
  const scenesWithDay = project.scenes.filter((sc) => sc._count.shootingDayScenes > 0).length;
  const charactersTotal = project.characters.length;
  const charactersWithActor = project.characters.filter((c) => c.actorId).length;

  const shotsPlanned = days.reduce((n, d) => n + d.shots.length, 0);
  const shotsDone = days.reduce((n, d) => n + d.shots.filter((sh) => sh.done).length, 0);
  const shotsTotal = data.shotsTotal;

  const upcoming = days.filter((d) => dayOf(d.date) >= today);
  const next = upcoming[0] ?? null;
  const nextShoot: NextShoot | null = next
    ? (() => {
        const sceneIds = new Set(next.scenes.map((a) => a.sceneId));
        const locationNames = [
          ...new Set(
            project.scenes
              .filter((sc) => sceneIds.has(sc.id) && sc.location)
              .map((sc) => sc.location!.name),
          ),
        ];
        return {
          dayId: next.id,
          date: next.date,
          daysUntil: dayOf(next.date) - today,
          scenes: next.scenes.length,
          shots: next.shots.length,
          locationNames,
          callTime: next.callSheet?.generalCallTime ?? next.scenes.find((a) => a.callTime)?.callTime ?? null,
          hasCallSheet: Boolean(next.callSheet),
        };
      })()
    : null;

  const span =
    days.length > 0
      ? {
          first: days[0].date,
          last: days[days.length - 1].date,
          total: days.length,
          past: days.filter((d) => dayOf(d.date) < today).length,
        }
      : null;

  const progress: SummaryProgress[] = [
    {
      key: "guion",
      label: "Guion",
      done: scenesWithLocation,
      total: scenesTotal,
      hint: "escenas con localización",
      tool: "guion",
    },
    {
      key: "reparto",
      label: "Reparto",
      done: charactersWithActor,
      total: charactersTotal,
      hint: "personajes con actor",
      tool: "personajes",
    },
    {
      key: "shot-list",
      label: "Shot list",
      done: scenesWithShots,
      total: scenesTotal,
      hint: "escenas con planos",
      tool: "shot-list",
    },
  ];
  if (shotsTotal > 0) {
    progress.push({
      key: "storyboard",
      label: "Storyboard",
      done: data.shotsWithFrames,
      total: shotsTotal,
      hint: "planos con viñeta",
      tool: "storyboard",
    });
  }
  progress.push(
    shotsTotal > 0
      ? {
          key: "plan",
          label: "Plan de rodaje",
          done: shotsPlanned,
          total: shotsTotal,
          hint: "planos con día",
          tool: "plan-de-rodaje",
        }
      : {
          key: "plan",
          label: "Plan de rodaje",
          done: scenesWithDay,
          total: scenesTotal,
          hint: "escenas con día",
          tool: "plan-de-rodaje",
        },
  );
  if (days.length > 0) {
    progress.push({
      key: "call-sheets",
      label: "Call sheets",
      done: days.filter((d) => d.callSheet).length,
      total: days.length,
      hint: "días con call sheet",
      tool: "call-sheets",
    });
  }

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const pending: SummaryPending[] = [];
  if (scenesTotal === 0) {
    pending.push({ text: "Aún no hay escenas: sube el guion o créalas a mano", tool: "guion" });
  } else {
    const noLocation = scenesTotal - scenesWithLocation;
    if (noLocation > 0) pending.push({ text: `${plural(noLocation, "escena sin localización", "escenas sin localización")}`, tool: "guion" });
  }
  if (charactersTotal > 0 && charactersWithActor < charactersTotal) {
    const n = charactersTotal - charactersWithActor;
    pending.push({ text: `${plural(n, "personaje sin actor", "personajes sin actor")}`, tool: "personajes" });
  }
  if (scenesTotal > 0 && shotsTotal === 0) {
    pending.push({ text: "Sin shot list: define los planos de cada escena", tool: "shot-list" });
  } else if (scenesTotal > scenesWithShots && shotsTotal > 0) {
    const n = scenesTotal - scenesWithShots;
    pending.push({ text: `${plural(n, "escena sin planos definidos", "escenas sin planos definidos")}`, tool: "shot-list" });
  }
  if (shotsTotal > 0 && shotsPlanned < shotsTotal) {
    const n = shotsTotal - shotsPlanned;
    pending.push({ text: `${plural(n, "plano sin día de rodaje", "planos sin día de rodaje")}`, tool: "plan-de-rodaje" });
  } else if (shotsTotal === 0 && scenesTotal > scenesWithDay) {
    const n = scenesTotal - scenesWithDay;
    pending.push({ text: `${plural(n, "escena sin día de rodaje", "escenas sin día de rodaje")}`, tool: "plan-de-rodaje" });
  }
  if (scenesTotal > 0 && days.length === 0) {
    pending.push({ text: "Todavía no hay días de rodaje", tool: "plan-de-rodaje" });
  }
  const daysWithoutSheet = upcoming.filter((d) => !d.callSheet).length;
  if (daysWithoutSheet > 0) {
    pending.push({
      text: `${plural(daysWithoutSheet, "próximo día sin call sheet", "próximos días sin call sheet")}`,
      tool: "call-sheets",
    });
  }
  if (data.storyboardFramesCount > 0 && data.shotsWithFrames < shotsTotal) {
    const n = shotsTotal - data.shotsWithFrames;
    pending.push({ text: `${plural(n, "plano sin viñeta de storyboard", "planos sin viñeta de storyboard")}`, tool: "storyboard" });
  }

  const target = project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  if (data.budgetCategoriesWithTotals.length === 0) {
    pending.push({ text: "El presupuesto está vacío", tool: "presupuesto" });
  } else if (target !== null && data.budgetGrandTotal > target) {
    const over = data.budgetGrandTotal - target;
    pending.push({
      text: `Presupuesto ${over.toLocaleString("es-ES", { maximumFractionDigits: 0 })} € por encima del objetivo`,
      tool: "presupuesto",
    });
  }

  return {
    nextShoot,
    span,
    shots: { total: shotsTotal, planned: shotsPlanned, done: shotsDone },
    budget: {
      total: data.budgetGrandTotal,
      actual: data.budgetGrandActual,
      target,
      hasActual: data.hasBudgetActual,
    },
    progress,
    pending: pending.slice(0, 8),
  };
}
