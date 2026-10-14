// Todo lo que necesita el Plan de rodaje (jornadas con su orden de rodaje,
// lo que falta por programar y la cobertura por escenas), ya sincronizado y
// en forma serializable para el editor del cliente.

import type { DayPart, IntExt } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { syncProjectSchedule } from "@/lib/schedule-core";
import { getProjectScheduleConflicts, type DayConflict } from "@/lib/schedule-conflicts";
import type { PlanBlock, PlanShot } from "@/lib/schedule-plan";

export type SceneInfo = {
  id: string;
  number: string;
  intExt: IntExt;
  dayPart: DayPart;
  location: string | null;
  description: string | null;
  characterIds: string[];
  shotCount: number;
};

export type PoolShot = PlanShot & { retake: boolean; retakeNote: string | null };

export type ScheduleDay = {
  id: string;
  dateISO: string;
  title: string; // "Día 2"
  dateLabel: string; // "Viernes, 16 de octubre"
  shortLabel: string; // "Día 2 · vie 16 oct"
  callTime: string | null;
  prepMin: number | null;
  lat: number | null;
  lng: number | null;
  locations: string[];
  sheet: { exists: boolean; shared: boolean; outdated: boolean };
  conflicts: DayConflict[];
  blocks: PlanBlock[];
};

export type ScheduleData = {
  workdayHours: number;
  scenes: Record<string, SceneInfo>;
  characters: Record<string, { name: string; actor: string | null }>;
  days: ScheduleDay[];
  pool: { shots: PoolShot[]; scenes: string[] }; // escenas sin planos y sin día
  coverage: { sceneId: string; shots: { id: string; number: string; dayId: string | null; done: boolean; retake: boolean }[] }[];
  totals: { shots: number; scheduled: number; done: number; retakes: number };
};

export async function getScheduleData(projectId: string): Promise<ScheduleData> {
  await syncProjectSchedule(projectId);

  const [project, days, scenes, characters, conflicts] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { workdayHours: true } }),
    prisma.shootingDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        callTime: true,
        prepMin: true,
        planUpdatedAt: true,
        shareToken: true,
        reminderSentAt: true,
        callSheet: { select: { updatedAt: true, generalCallTime: true } },
        scheduleBlocks: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            kind: true,
            title: true,
            durationMin: true,
            startTime: true,
            notes: true,
            sceneId: true,
            shots: { orderBy: { blockOrder: "asc" }, select: { id: true } },
          },
        },
      },
    }),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        description: true,
        location: { select: { name: true, latitude: true, longitude: true } },
        characters: { select: { characterId: true } },
        shootingDayScenes: { select: { shootingDayId: true } },
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          select: {
            id: true,
            number: true,
            shotSize: true,
            movement: true,
            description: true,
            estimatedMin: true,
            shootingDayId: true,
            done: true,
            retake: true,
            retakeNote: true,
            characters: { select: { characterId: true } },
          },
        },
      },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, actor: { select: { name: true } } },
    }),
    getProjectScheduleConflicts(projectId),
  ]);

  const sceneInfo: Record<string, SceneInfo> = {};
  const shotById = new Map<string, PoolShot>();
  for (const scene of scenes) {
    sceneInfo[scene.id] = {
      id: scene.id,
      number: scene.number,
      intExt: scene.intExt,
      dayPart: scene.dayPart,
      location: scene.location?.name ?? null,
      description: scene.description,
      characterIds: scene.characters.map((c) => c.characterId),
      shotCount: scene.shots.length,
    };
    for (const shot of scene.shots) {
      shotById.set(shot.id, {
        id: shot.id,
        sceneId: scene.id,
        sceneNumber: scene.number,
        number: shot.number,
        shotSize: shot.shotSize,
        movement: shot.movement,
        description: shot.description,
        estimatedMin: shot.estimatedMin,
        intExt: scene.intExt,
        dayPart: scene.dayPart,
        // Sin personajes por plano, los de la escena (para citar a la gente).
        characterIds: shot.characters.length > 0 ? shot.characters.map((c) => c.characterId) : scene.characters.map((c) => c.characterId),
        done: shot.done,
        retake: shot.retake,
        retakeNote: shot.retakeNote,
      });
    }
  }

  const tz = "Europe/Madrid";
  const scheduleDays: ScheduleDay[] = days.map((day, i) => {
    const long = day.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
    const short = day.date
      .toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: tz })
      .replace(/\./g, "")
      .replace(",", "");
    const blocks: PlanBlock[] = day.scheduleBlocks.map((b) => {
      const scene = b.sceneId ? sceneInfo[b.sceneId] : undefined;
      return {
        id: b.id,
        kind: b.kind,
        title: b.title,
        durationMin: b.durationMin,
        startTime: b.startTime,
        notes: b.notes,
        scene:
          b.kind === "SCENE" && scene
            ? { id: scene.id, number: scene.number, intExt: scene.intExt, dayPart: scene.dayPart, characterIds: scene.characterIds, durationMin: null }
            : null,
        shots: b.shots.map((s) => shotById.get(s.id)).filter((s): s is PoolShot => Boolean(s)),
      };
    });
    const daySceneIds = new Set<string>();
    for (const b of blocks) {
      if (b.scene) daySceneIds.add(b.scene.id);
      for (const s of b.shots) daySceneIds.add(s.sceneId);
    }
    const located = scenes.find((s) => daySceneIds.has(s.id) && s.location?.latitude != null && s.location?.longitude != null);
    const locations = [...new Set(scenes.filter((s) => daySceneIds.has(s.id) && s.location).map((s) => s.location!.name))];
    const shared = Boolean(day.shareToken || day.reminderSentAt);
    return {
      id: day.id,
      dateISO: day.date.toISOString(),
      title: `Día ${i + 1}`,
      dateLabel: long.charAt(0).toUpperCase() + long.slice(1),
      shortLabel: `Día ${i + 1} · ${short}`,
      callTime: day.callTime ?? day.callSheet?.generalCallTime ?? null,
      prepMin: day.prepMin,
      lat: located?.location?.latitude ?? null,
      lng: located?.location?.longitude ?? null,
      locations,
      sheet: {
        exists: Boolean(day.callSheet),
        shared,
        outdated: Boolean(shared && day.callSheet && day.planUpdatedAt && day.planUpdatedAt > day.callSheet.updatedAt),
      },
      conflicts: conflicts.get(day.id) ?? [],
      blocks,
    };
  });

  const poolShots = [...shotById.values()].filter((s) => {
    const raw = scenes.find((sc) => sc.id === s.sceneId)?.shots.find((sh) => sh.id === s.id);
    return raw && !raw.shootingDayId && !raw.done;
  });
  const poolScenes = scenes.filter((s) => s.shots.length === 0 && s.shootingDayScenes.length === 0).map((s) => s.id);

  const allShots = scenes.flatMap((s) => s.shots);
  return {
    workdayHours: project?.workdayHours ?? 10,
    scenes: sceneInfo,
    characters: Object.fromEntries(characters.map((c) => [c.id, { name: c.name, actor: c.actor?.name ?? null }])),
    days: scheduleDays,
    pool: { shots: poolShots, scenes: poolScenes },
    coverage: scenes.map((s) => ({
      sceneId: s.id,
      shots: s.shots.map((sh) => ({ id: sh.id, number: sh.number, dayId: sh.shootingDayId, done: sh.done, retake: sh.retake })),
    })),
    totals: {
      shots: allShots.length,
      scheduled: allShots.filter((s) => s.shootingDayId).length,
      done: allShots.filter((s) => s.done).length,
      retakes: allShots.filter((s) => s.retake && !s.shootingDayId).length,
    },
  };
}
