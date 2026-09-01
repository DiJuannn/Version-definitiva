import { prisma } from "@/lib/prisma";

export async function getProjectSummary(projectId: string) {
  const [project, storyboardFramesCount, itemReservations, vehicleReservations] =
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
              _count: { select: { shots: true } },
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
    return { ...category, total };
  });
  const budgetGrandTotal = budgetCategoriesWithTotals.reduce(
    (sum, c) => sum + c.total,
    0,
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
    budgetCategoriesWithTotals,
    budgetGrandTotal,
    inventoryItems: [...itemsMap.values()],
    vehicles: [...vehiclesMap.values()],
    shootingDaysWithNeeds,
  };
}

export type ProjectSummaryData = Awaited<ReturnType<typeof getProjectSummary>>;
