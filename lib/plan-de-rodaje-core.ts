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

export async function updateDaySceneAssignmentsCore(
  projectId: string,
  shootingDayId: string,
  assignments: { sceneId: string; callTime: string | null; order: number }[],
): Promise<boolean> {
  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId } });
  if (!day) return false;

  const validSceneIds = new Set(
    (await prisma.scene.findMany({ where: { projectId }, select: { id: true } })).map((s) => s.id),
  );
  const filtered = assignments.filter((a) => validSceneIds.has(a.sceneId));

  await prisma.$transaction([
    prisma.shootingDayScene.deleteMany({ where: { shootingDayId } }),
    prisma.shootingDayScene.createMany({
      data: filtered.map((a) => ({
        shootingDayId,
        sceneId: a.sceneId,
        callTime: a.callTime,
        order: a.order,
      })),
    }),
  ]);
  return true;
}
