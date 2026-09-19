import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

export async function createShootingDayCore(
  projectId: string,
  date: Date,
): Promise<{ id: string; existing: boolean } | null> {
  if (Number.isNaN(date.getTime())) return null;

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const existing = await prisma.shootingDay.findFirst({
    where: { projectId, date: { gte: dayStart, lt: dayEnd } },
  });
  if (existing) return { id: existing.id, existing: true };

  const day = await prisma.shootingDay.create({ data: { projectId, date } });
  return { id: day.id, existing: false };
}

export async function updateShootingDayCore(
  projectId: string,
  shootingDayId: string,
  input: { date: Date; notes: string | null },
): Promise<boolean> {
  if (Number.isNaN(input.date.getTime())) return false;

  await prisma.shootingDay.updateMany({
    where: { id: shootingDayId, projectId },
    data: { date: input.date, notes: input.notes },
  });
  return true;
}

export async function deleteShootingDayCore(projectId: string, shootingDayId: string) {
  await prisma.shootingDay.deleteMany({ where: { id: shootingDayId, projectId } });
}

type Tx = Prisma.TransactionClient;

// Una escena que tiene planos solo está en los días en los que se rueda alguno
// de sus planos; una escena sin planos está donde se la haya puesto. Esta
// función deja las filas de ShootingDayScene de esas escenas cuadradas con sus
// planos: crea las que falten (día con planos, sin fila) y borra las que
// sobren (fila en un día donde ya no se rueda ninguno de sus planos).
async function reconcileSceneDays(tx: Tx, sceneIds: string[]) {
  for (const sceneId of new Set(sceneIds)) {
    const shots = await tx.shot.findMany({ where: { sceneId }, select: { shootingDayId: true } });
    if (shots.length === 0) continue;

    const dayIds = [...new Set(shots.map((s) => s.shootingDayId).filter((id): id is string => Boolean(id)))];
    await tx.shootingDayScene.deleteMany({
      where: { sceneId, ...(dayIds.length > 0 ? { shootingDayId: { notIn: dayIds } } : {}) },
    });

    const existing = new Set(
      (await tx.shootingDayScene.findMany({ where: { sceneId }, select: { shootingDayId: true } })).map(
        (r) => r.shootingDayId,
      ),
    );
    for (const dayId of dayIds) {
      if (existing.has(dayId)) continue;
      const order = await tx.shootingDayScene.count({ where: { shootingDayId: dayId } });
      await tx.shootingDayScene.create({ data: { shootingDayId: dayId, sceneId, order } });
    }
  }
}

export type DayPlanInput = {
  assignments: { sceneId: string; callTime: string | null; order: number }[];
  // Planos que se ruedan este día y cuáles de ellos ya están rodados. Si no se
  // manda (clientes antiguos), los planos no se tocan salvo los de escenas que
  // salen del día.
  shotIds?: string[];
  doneShotIds?: string[];
};

export async function updateDaySceneAssignmentsCore(
  projectId: string,
  shootingDayId: string,
  input: DayPlanInput["assignments"] | DayPlanInput,
): Promise<boolean> {
  const plan: DayPlanInput = Array.isArray(input) ? { assignments: input } : input;

  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId } });
  if (!day) return false;

  const [scenes, shots] = await Promise.all([
    prisma.scene.findMany({ where: { projectId }, select: { id: true } }),
    prisma.shot.findMany({
      where: { scene: { projectId } },
      select: { id: true, sceneId: true, shootingDayId: true },
    }),
  ]);
  const validSceneIds = new Set(scenes.map((sc) => sc.id));
  const shotById = new Map(shots.map((sh) => [sh.id, sh]));

  const assigned = new Map<string, { callTime: string | null; order: number }>();
  for (const a of plan.assignments) {
    if (validSceneIds.has(a.sceneId)) assigned.set(a.sceneId, { callTime: a.callTime, order: a.order });
  }

  const selected = plan.shotIds
    ? new Set(plan.shotIds.filter((id) => shotById.has(id)))
    : null;
  const done = new Set((plan.doneShotIds ?? []).filter((id) => selected?.has(id)));

  // Un plano seleccionado mete a su escena en el día aunque no se haya marcado la escena.
  if (selected) {
    let nextOrder = assigned.size;
    for (const id of selected) {
      const sceneId = shotById.get(id)!.sceneId;
      if (!assigned.has(sceneId)) assigned.set(sceneId, { callTime: null, order: nextOrder++ });
    }
  }

  // Escenas afectadas: las del día ahora, las que había antes y las de los planos que cambian de día.
  const touched = new Set<string>(assigned.keys());
  for (const sh of shots) {
    if (sh.shootingDayId === shootingDayId) touched.add(sh.sceneId);
  }
  if (selected) for (const id of selected) touched.add(shotById.get(id)!.sceneId);

  await prisma.$transaction(async (tx) => {
    await tx.shootingDayScene.deleteMany({ where: { shootingDayId } });
    await tx.shootingDayScene.createMany({
      data: [...assigned.entries()].map(([sceneId, a]) => ({
        shootingDayId,
        sceneId,
        callTime: a.callTime,
        order: a.order,
      })),
    });

    if (selected) {
      // Los planos que estaban en este día y ya no se marcan quedan sin planificar.
      const leaving = shots
        .filter((sh) => sh.shootingDayId === shootingDayId && !selected.has(sh.id))
        .map((sh) => sh.id);
      if (leaving.length > 0) {
        await tx.shot.updateMany({ where: { id: { in: leaving } }, data: { shootingDayId: null, done: false } });
      }
      const doneIds = [...done];
      const pendingIds = [...selected].filter((id) => !done.has(id));
      if (doneIds.length > 0) {
        await tx.shot.updateMany({ where: { id: { in: doneIds } }, data: { shootingDayId, done: true } });
      }
      if (pendingIds.length > 0) {
        await tx.shot.updateMany({ where: { id: { in: pendingIds } }, data: { shootingDayId, done: false } });
      }
    } else {
      const leaving = shots
        .filter((sh) => sh.shootingDayId === shootingDayId && !assigned.has(sh.sceneId))
        .map((sh) => sh.id);
      if (leaving.length > 0) {
        await tx.shot.updateMany({ where: { id: { in: leaving } }, data: { shootingDayId: null, done: false } });
      }
    }

    await reconcileSceneDays(tx, [...touched]);
  });
  return true;
}

// Mueve un "trozo" de escena de un día a otro (o a "sin asignar" con null): todos los
// planos de la escena que se ruedan en `fromDayId`. Si la escena no tiene planos, se
// mueve la escena entera, como antes.
export async function moveSceneChunkCore(
  projectId: string,
  sceneId: string,
  fromDayId: string | null,
  toDayId: string | null,
): Promise<boolean> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId },
    select: { id: true, _count: { select: { shots: true } } },
  });
  if (!scene) return false;

  if (toDayId) {
    const day = await prisma.shootingDay.findFirst({ where: { id: toDayId, projectId } });
    if (!day) return false;
  }

  if (scene._count.shots === 0) {
    await prisma.$transaction(async (tx) => {
      await tx.shootingDayScene.deleteMany({ where: { sceneId } });
      if (toDayId) {
        const order = await tx.shootingDayScene.count({ where: { shootingDayId: toDayId } });
        await tx.shootingDayScene.create({ data: { shootingDayId: toDayId, sceneId, order } });
      }
    });
    return true;
  }

  await prisma.$transaction(async (tx) => {
    await tx.shot.updateMany({
      where: { sceneId, shootingDayId: fromDayId },
      data: { shootingDayId: toDayId, done: false },
    });
    await reconcileSceneDays(tx, [sceneId]);
  });
  return true;
}

// Pone un plano concreto en un día (o lo deja sin planificar con null).
export async function assignShotToDayCore(
  projectId: string,
  shotId: string,
  shootingDayId: string | null,
): Promise<{ sceneId: string } | null> {
  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
    select: { id: true, sceneId: true },
  });
  if (!shot) return null;

  if (shootingDayId) {
    const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId } });
    if (!day) return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.shot.update({ where: { id: shotId }, data: { shootingDayId, done: false } });
    await reconcileSceneDays(tx, [shot.sceneId]);
  });
  return { sceneId: shot.sceneId };
}

export async function setShotDoneCore(projectId: string, shotId: string, done: boolean): Promise<boolean> {
  const result = await prisma.shot.updateMany({
    where: { id: shotId, scene: { projectId }, ...(done ? { shootingDayId: { not: null } } : {}) },
    data: { done },
  });
  return result.count > 0;
}
