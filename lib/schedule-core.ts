// Orden de rodaje por planos (bloques de cada jornada). Lo comparten las
// Server Actions y las rutas del móvil.
//
// Regla de oro: el DÍA de un plano lo dice `Shot.shootingDayId` (como
// siempre, así la app instalada y las pantallas antiguas siguen valiendo);
// el BLOQUE y la posición dentro del día se ajustan a eso al sincronizar.
// Las escenas sin lista de planos están en un día por ShootingDayScene y
// tienen un bloque SCENE que las representa.

import type { Prisma, ScheduleBlockKind } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

// Las transacciones del plan hacen varias escrituras seguidas contra una base
// remota: los 5 s por defecto de Prisma se quedan cortos.
function inTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { maxWait: 10_000, timeout: 30_000 });
}

// Deja cuadrado el orden de rodaje de un proyecto con los días de sus planos
// y escenas. Idempotente: si ya está bien, no escribe nada. También es la
// "migración" de los planes de antes: la primera vez crea sus bloques.
export async function syncProjectSchedule(projectId: string, client: Tx | typeof prisma = prisma): Promise<boolean> {
  const [days, blocks, shots, scenes, dayScenes] = await Promise.all([
    client.shootingDay.findMany({ where: { projectId }, select: { id: true } }),
    client.scheduleBlock.findMany({
      where: { shootingDay: { projectId } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, shootingDayId: true, kind: true, order: true, sceneId: true },
    }),
    client.shot.findMany({
      where: { scene: { projectId } },
      orderBy: [{ blockOrder: "asc" }, { order: "asc" }, { number: "asc" }],
      select: { id: true, sceneId: true, shootingDayId: true, blockId: true, blockOrder: true, scene: { select: { order: true } } },
    }),
    client.scene.findMany({ where: { projectId }, select: { id: true, order: true, _count: { select: { shots: true } } } }),
    client.shootingDayScene.findMany({
      where: { shootingDay: { projectId } },
      orderBy: { order: "asc" },
      select: { id: true, shootingDayId: true, sceneId: true, order: true },
    }),
  ]);
  if (days.length === 0) return false;

  let changed = false;
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const blocksByDay = new Map<string, typeof blocks>();
  for (const day of days) blocksByDay.set(day.id, []);
  for (const b of blocks) blocksByDay.get(b.shootingDayId)?.push(b);
  const sceneHasShots = new Map(scenes.map((s) => [s.id, s._count.shots > 0]));

  // 1. Cada plano, en un bloque de su día (o en ninguno si no tiene día).
  const shotsByBlock = new Map<string, typeof shots>();
  const homeless = new Map<string, typeof shots>();
  for (const shot of shots) {
    const block = shot.blockId ? blockById.get(shot.blockId) : undefined;
    if (!shot.shootingDayId) {
      if (shot.blockId) {
        await client.shot.update({ where: { id: shot.id }, data: { blockId: null, blockOrder: 0 } });
        changed = true;
      }
      continue;
    }
    if (block && block.shootingDayId === shot.shootingDayId && block.kind === "SHOTS") {
      shotsByBlock.set(block.id, [...(shotsByBlock.get(block.id) ?? []), shot]);
    } else {
      homeless.set(shot.shootingDayId, [...(homeless.get(shot.shootingDayId) ?? []), shot]);
    }
  }
  for (const [dayId, list] of homeless) {
    const dayBlocks = blocksByDay.get(dayId) ?? [];
    let target = [...dayBlocks].reverse().find((b) => b.kind === "SHOTS");
    if (!target) {
      const created = await client.scheduleBlock.create({
        data: { shootingDayId: dayId, kind: "SHOTS", order: dayBlocks.length },
        select: { id: true, shootingDayId: true, kind: true, order: true, sceneId: true },
      });
      dayBlocks.push(created);
      blockById.set(created.id, created);
      target = created;
    }
    const existing = shotsByBlock.get(target.id) ?? [];
    // Los que llegan sin sitio van al final, en orden de guion.
    const sorted = [...list].sort((a, b) => a.scene.order - b.scene.order || a.blockOrder - b.blockOrder);
    let next = existing.reduce((n, s) => Math.max(n, s.blockOrder + 1), 0);
    for (const shot of sorted) {
      await client.shot.update({ where: { id: shot.id }, data: { blockId: target.id, blockOrder: next++ } });
      existing.push({ ...shot, blockId: target.id });
    }
    shotsByBlock.set(target.id, existing);
    changed = true;
  }

  // 2. Escenas sin planos: un bloque SCENE por cada día en que están, y nada más.
  for (const ds of dayScenes) {
    if (sceneHasShots.get(ds.sceneId)) continue;
    const dayBlocks = blocksByDay.get(ds.shootingDayId) ?? [];
    if (!dayBlocks.some((b) => b.kind === "SCENE" && b.sceneId === ds.sceneId)) {
      const created = await client.scheduleBlock.create({
        data: { shootingDayId: ds.shootingDayId, kind: "SCENE", sceneId: ds.sceneId, order: dayBlocks.length },
        select: { id: true, shootingDayId: true, kind: true, order: true, sceneId: true },
      });
      dayBlocks.push(created);
      changed = true;
    }
  }
  for (const b of blocks) {
    if (b.kind !== "SCENE") continue;
    const stillThere =
      b.sceneId && !sceneHasShots.get(b.sceneId) && dayScenes.some((ds) => ds.shootingDayId === b.shootingDayId && ds.sceneId === b.sceneId);
    if (!stillThere) {
      await client.scheduleBlock.delete({ where: { id: b.id } });
      const list = blocksByDay.get(b.shootingDayId);
      if (list) blocksByDay.set(b.shootingDayId, list.filter((x) => x.id !== b.id));
      changed = true;
    }
  }

  // 3. ShootingDayScene de las escenas con planos = días donde se rueda alguno,
  //    y su orden = el de su primera aparición en el orden de rodaje.
  for (const day of days) {
    const dayBlocks = blocksByDay.get(day.id) ?? [];
    const sequence: string[] = [];
    for (const b of dayBlocks) {
      if (b.kind === "SCENE" && b.sceneId) sequence.push(b.sceneId);
      if (b.kind === "SHOTS") {
        for (const s of (shotsByBlock.get(b.id) ?? []).sort((x, y) => x.blockOrder - y.blockOrder)) sequence.push(s.sceneId);
      }
    }
    const wanted = [...new Set(sequence)];
    const rows = dayScenes.filter((ds) => ds.shootingDayId === day.id);
    for (const row of rows) {
      if (sceneHasShots.get(row.sceneId) && !wanted.includes(row.sceneId)) {
        await client.shootingDayScene.delete({ where: { id: row.id } });
        changed = true;
      }
    }
    for (const [i, sceneId] of wanted.entries()) {
      const row = rows.find((r) => r.sceneId === sceneId);
      if (!row) {
        await client.shootingDayScene.create({ data: { shootingDayId: day.id, sceneId, order: i } });
        changed = true;
      } else if (row.order !== i) {
        await client.shootingDayScene.update({ where: { id: row.id }, data: { order: i } });
        changed = true;
      }
    }
  }
  return changed;
}

async function touchDays(tx: Tx, dayIds: (string | null | undefined)[]) {
  const ids = [...new Set(dayIds.filter((d): d is string => Boolean(d)))];
  if (ids.length > 0) await tx.shootingDay.updateMany({ where: { id: { in: ids } }, data: { planUpdatedAt: new Date() } });
}

async function renumberBlocks(tx: Tx, dayId: string, orderedIds: string[]) {
  for (const [i, id] of orderedIds.entries()) await tx.scheduleBlock.update({ where: { id }, data: { order: i } });
  void dayId;
}

async function dayOfProject(projectId: string, dayId: string) {
  return prisma.shootingDay.findFirst({ where: { id: dayId, projectId }, select: { id: true } });
}

async function blockOfProject(projectId: string, blockId: string) {
  return prisma.scheduleBlock.findFirst({
    where: { id: blockId, shootingDay: { projectId } },
    select: { id: true, shootingDayId: true, kind: true, sceneId: true, order: true },
  });
}

// --- Bloques -------------------------------------------------------------

export async function createBlockCore(
  projectId: string,
  dayId: string,
  input: { kind: ScheduleBlockKind; title?: string | null; durationMin?: number | null; index?: number },
): Promise<string | null> {
  if (input.kind === "SCENE") return null;
  if (!(await dayOfProject(projectId, dayId))) return null;
  return inTx(async (tx) => {
    const current = await tx.scheduleBlock.findMany({ where: { shootingDayId: dayId }, orderBy: { order: "asc" }, select: { id: true } });
    const created = await tx.scheduleBlock.create({
      data: { shootingDayId: dayId, kind: input.kind, title: input.title ?? null, durationMin: input.durationMin ?? null },
      select: { id: true },
    });
    const ids = current.map((b) => b.id);
    ids.splice(Math.max(0, Math.min(input.index ?? ids.length, ids.length)), 0, created.id);
    await renumberBlocks(tx, dayId, ids);
    await touchDays(tx, [dayId]);
    return created.id;
  });
}

export async function updateBlockCore(
  projectId: string,
  blockId: string,
  patch: { title?: string | null; durationMin?: number | null; startTime?: string | null; notes?: string | null },
): Promise<boolean> {
  const block = await blockOfProject(projectId, blockId);
  if (!block) return false;
  await inTx(async (tx) => {
    await tx.scheduleBlock.update({ where: { id: blockId }, data: patch });
    await touchDays(tx, [block.shootingDayId]);
  });
  return true;
}

// Borra un bloque; lo que había dentro vuelve a "por programar".
export async function deleteBlockCore(projectId: string, blockId: string): Promise<boolean> {
  const block = await blockOfProject(projectId, blockId);
  if (!block) return false;
  await inTx(async (tx) => {
    await tx.shot.updateMany({ where: { blockId }, data: { blockId: null, blockOrder: 0, shootingDayId: null, done: false } });
    if (block.kind === "SCENE" && block.sceneId) {
      await tx.shootingDayScene.deleteMany({ where: { shootingDayId: block.shootingDayId, sceneId: block.sceneId } });
    }
    await tx.scheduleBlock.delete({ where: { id: blockId } });
    await syncProjectSchedule(projectId, tx);
    await touchDays(tx, [block.shootingDayId]);
  });
  return true;
}

// Mueve un bloque (con todo lo que lleva) a otra posición o a otra jornada.
export async function moveBlockCore(projectId: string, blockId: string, toDayId: string, index: number): Promise<boolean> {
  const block = await blockOfProject(projectId, blockId);
  if (!block || !(await dayOfProject(projectId, toDayId))) return false;
  await inTx(async (tx) => {
    const fromDayId = block.shootingDayId;
    if (fromDayId !== toDayId) {
      await tx.scheduleBlock.update({ where: { id: blockId }, data: { shootingDayId: toDayId } });
      await tx.shot.updateMany({ where: { blockId }, data: { shootingDayId: toDayId, done: false } });
      if (block.kind === "SCENE" && block.sceneId) {
        await tx.shootingDayScene.deleteMany({ where: { shootingDayId: fromDayId, sceneId: block.sceneId } });
        const exists = await tx.shootingDayScene.findFirst({ where: { shootingDayId: toDayId, sceneId: block.sceneId } });
        if (!exists) await tx.shootingDayScene.create({ data: { shootingDayId: toDayId, sceneId: block.sceneId, order: 999 } });
      }
      const rest = await tx.scheduleBlock.findMany({ where: { shootingDayId: fromDayId }, orderBy: { order: "asc" }, select: { id: true } });
      await renumberBlocks(tx, fromDayId, rest.map((b) => b.id));
    }
    const target = await tx.scheduleBlock.findMany({
      where: { shootingDayId: toDayId, id: { not: blockId } },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    const ids = target.map((b) => b.id);
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, blockId);
    await renumberBlocks(tx, toDayId, ids);
    await syncProjectSchedule(projectId, tx);
    await touchDays(tx, [fromDayId, toDayId]);
  });
  return true;
}

// --- Planos --------------------------------------------------------------

export type ShotTarget =
  | { kind: "block"; blockId: string; index?: number }
  | { kind: "newBlock"; dayId: string; title?: string | null }
  | { kind: "pool" };

// Pone uno o varios planos (de cualquier escena) en un bloque y posición, en
// un bloque nuevo al final de una jornada, o los devuelve a "por programar".
export async function placeShotsCore(projectId: string, shotIds: string[], target: ShotTarget): Promise<boolean> {
  const shots = await prisma.shot.findMany({
    where: { id: { in: shotIds }, scene: { projectId } },
    select: { id: true, shootingDayId: true, blockId: true },
  });
  if (shots.length === 0) return false;
  const ordered = shotIds.map((id) => shots.find((s) => s.id === id)).filter((s): s is (typeof shots)[number] => Boolean(s));
  const fromDays = ordered.map((s) => s.shootingDayId);

  if (target.kind === "pool") {
    await inTx(async (tx) => {
      await tx.shot.updateMany({
        where: { id: { in: ordered.map((s) => s.id) } },
        data: { shootingDayId: null, blockId: null, blockOrder: 0, done: false },
      });
      await syncProjectSchedule(projectId, tx);
      await touchDays(tx, fromDays);
    });
    return true;
  }

  let blockId: string;
  let dayId: string;
  if (target.kind === "newBlock") {
    if (!(await dayOfProject(projectId, target.dayId))) return false;
    const id = await createBlockCore(projectId, target.dayId, { kind: "SHOTS", title: target.title ?? null });
    if (!id) return false;
    blockId = id;
    dayId = target.dayId;
  } else {
    const block = await blockOfProject(projectId, target.blockId);
    if (!block || block.kind !== "SHOTS") return false;
    blockId = block.id;
    dayId = block.shootingDayId;
  }

  await inTx(async (tx) => {
    const movingIds = new Set(ordered.map((s) => s.id));
    const inBlock = await tx.shot.findMany({
      where: { blockId, id: { notIn: [...movingIds] } },
      orderBy: { blockOrder: "asc" },
      select: { id: true },
    });
    const ids = inBlock.map((s) => s.id);
    const index = target.kind === "block" && target.index !== undefined ? target.index : ids.length;
    ids.splice(Math.max(0, Math.min(index, ids.length)), 0, ...ordered.map((s) => s.id));
    for (const [i, id] of ids.entries()) {
      const moving = ordered.find((s) => s.id === id);
      await tx.shot.update({
        where: { id },
        data: {
          blockId,
          blockOrder: i,
          shootingDayId: dayId,
          // Cambiar de jornada deja el plano sin rodar; reordenar en el mismo día, no.
          ...(moving && moving.shootingDayId !== dayId ? { done: false } : {}),
        },
      });
    }
    await syncProjectSchedule(projectId, tx);
    await touchDays(tx, [...fromDays, dayId]);
  });
  return true;
}

// Escena sin lista de planos: a una jornada (bloque SCENE) o a "por programar".
export async function placeSceneCore(projectId: string, sceneId: string, target: { dayId: string; index?: number } | null): Promise<boolean> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId }, select: { id: true, _count: { select: { shots: true } } } });
  if (!scene || scene._count.shots > 0) return false;
  if (target && !(await dayOfProject(projectId, target.dayId))) return false;
  await inTx(async (tx) => {
    const before = await tx.shootingDayScene.findMany({ where: { sceneId }, select: { shootingDayId: true } });
    await tx.shootingDayScene.deleteMany({ where: { sceneId } });
    if (target) {
      await tx.shootingDayScene.create({ data: { shootingDayId: target.dayId, sceneId, order: 999 } });
    }
    await syncProjectSchedule(projectId, tx);
    if (target && target.index !== undefined) {
      const blocks = await tx.scheduleBlock.findMany({ where: { shootingDayId: target.dayId }, orderBy: { order: "asc" }, select: { id: true, sceneId: true, kind: true } });
      const mine = blocks.find((b) => b.kind === "SCENE" && b.sceneId === sceneId);
      if (mine) {
        const ids = blocks.filter((b) => b.id !== mine.id).map((b) => b.id);
        ids.splice(Math.max(0, Math.min(target.index, ids.length)), 0, mine.id);
        await renumberBlocks(tx, target.dayId, ids);
        await syncProjectSchedule(projectId, tx);
      }
    }
    await touchDays(tx, [...before.map((b) => b.shootingDayId), target?.dayId]);
  });
  return true;
}

export async function setShotEstimateCore(projectId: string, shotId: string, minutes: number | null): Promise<boolean> {
  const value = minutes !== null && Number.isFinite(minutes) && minutes > 0 ? Math.min(Math.round(minutes), 24 * 60) : null;
  const shot = await prisma.shot.findFirst({ where: { id: shotId, scene: { projectId } }, select: { shootingDayId: true } });
  if (!shot) return false;
  await inTx(async (tx) => {
    await tx.shot.update({ where: { id: shotId }, data: { estimatedMin: value } });
    await touchDays(tx, [shot.shootingDayId]);
  });
  return true;
}

// "Hay que repetirlo": deja de estar rodado y vuelve a "por programar", con el motivo.
export async function markRetakeCore(projectId: string, shotId: string, note: string | null): Promise<boolean> {
  const shot = await prisma.shot.findFirst({ where: { id: shotId, scene: { projectId } }, select: { shootingDayId: true } });
  if (!shot) return false;
  await inTx(async (tx) => {
    await tx.shot.update({
      where: { id: shotId },
      data: { retake: true, retakeNote: note?.trim() || null, done: false, shootingDayId: null, blockId: null, blockOrder: 0 },
    });
    await syncProjectSchedule(projectId, tx);
    await touchDays(tx, [shot.shootingDayId]);
  });
  return true;
}

export async function setDayTimesCore(
  projectId: string,
  dayId: string,
  input: { callTime: string | null; prepMin: number | null },
): Promise<boolean> {
  if (!(await dayOfProject(projectId, dayId))) return false;
  await inTx(async (tx) => {
    await tx.shootingDay.update({
      where: { id: dayId },
      data: { callTime: input.callTime, prepMin: input.prepMin, planUpdatedAt: new Date() },
    });
    // La hoja de llamada (si existe) enseña la misma hora de llamada.
    await tx.callSheet.updateMany({ where: { shootingDayId: dayId }, data: { generalCallTime: input.callTime } });
  });
  return true;
}

export async function setWorkdayHoursCore(projectId: string, hours: number): Promise<boolean> {
  if (!Number.isFinite(hours) || hours < 4 || hours > 16) return false;
  await prisma.project.updateMany({ where: { id: projectId }, data: { workdayHours: Math.round(hours) } });
  return true;
}
