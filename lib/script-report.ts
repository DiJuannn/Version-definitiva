import { prisma } from "@/lib/prisma";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

// Parte de script: todas las tomas del proyecto (las de la claqueta y las
// apuntadas a mano) agrupadas por día → escena → plano, con la descripción de
// cada plano sacada de la shot list. Lo usan la pantalla Script de la web y la
// de la app (que lo recibe tal cual desde /api/mobile/.../script).

export type ScriptTake = {
  id: string;
  take: number;
  good: boolean;
  notes: string | null;
  // ISO; la hora se enseña en la zona de España.
  at: string;
  director: string | null;
  camera: string | null;
};

export type ScriptShot = {
  key: string;
  shotNumber: string | null;
  // "01.A", o "Sin plano" si la toma no llevaba plano.
  label: string;
  size: string | null;
  description: string | null;
  // false = el plano se escribió en la claqueta pero no existe en la shot list.
  inShotList: boolean;
  takes: ScriptTake[];
};

export type ScriptScene = {
  sceneNumber: string;
  context: string | null;
  shots: ScriptShot[];
};

export type ScriptDay = {
  dateKey: string;
  label: string;
  scenes: ScriptScene[];
};

export type ScriptSceneOption = {
  number: string;
  context: string | null;
  shots: { number: string; size: string | null; description: string | null }[];
};

export type ScriptReport = {
  days: ScriptDay[];
  scenes: ScriptSceneOption[];
  // Para el resumen de arriba: planos con toma buena sobre los de la shot list.
  shotsTotal: number;
  shotsWithGood: number;
};

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

function madridDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(date);
}

function dayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export async function getScriptReport(projectId: string): Promise<ScriptReport> {
  const [scenes, logs] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          select: { number: true, shotSize: true, description: true },
        },
      },
    }),
    prisma.clapLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const sceneByNumber = new Map(scenes.map((sc) => [norm(sc.number), sc]));
  const contextOf = (sc: (typeof scenes)[number] | undefined) =>
    sc
      ? [INT_EXT_LABELS[sc.intExt], DAY_PART_LABELS[sc.dayPart], sc.location?.name].filter(Boolean).join(" · ")
      : null;

  const days = new Map<string, Map<string, Map<string, ScriptShot>>>();
  for (const log of logs) {
    const dateKey = madridDateKey(log.createdAt);
    const scenesOfDay = days.get(dateKey) ?? new Map<string, Map<string, ScriptShot>>();
    days.set(dateKey, scenesOfDay);
    const shotsOfScene = scenesOfDay.get(log.sceneNumber) ?? new Map<string, ScriptShot>();
    scenesOfDay.set(log.sceneNumber, shotsOfScene);

    const shotKey = norm(log.shotNumber) || "__none__";
    let shot = shotsOfScene.get(shotKey);
    if (!shot) {
      const scene = sceneByNumber.get(norm(log.sceneNumber));
      const listed = log.shotNumber
        ? scene?.shots.find((sh) => norm(sh.number) === norm(log.shotNumber))
        : undefined;
      shot = {
        key: shotKey,
        shotNumber: log.shotNumber,
        label: log.shotNumber ? `${log.sceneNumber}.${log.shotNumber}` : "Sin plano",
        size: listed?.shotSize ?? null,
        description: listed?.description ?? null,
        inShotList: Boolean(listed),
        takes: [],
      };
      shotsOfScene.set(shotKey, shot);
    }
    shot.takes.push({
      id: log.id,
      take: log.take,
      good: log.good,
      notes: log.notes,
      at: log.createdAt.toISOString(),
      director: log.director,
      camera: log.camera,
    });
  }

  const dayList: ScriptDay[] = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, scenesOfDay]) => ({
      dateKey,
      label: dayLabel(dateKey),
      scenes: [...scenesOfDay.entries()].map(([sceneNumber, shotsOfScene]) => ({
        sceneNumber,
        context: contextOf(sceneByNumber.get(norm(sceneNumber))),
        shots: [...shotsOfScene.values()].map((shot) => ({
          ...shot,
          takes: [...shot.takes].sort((a, b) => a.take - b.take || a.at.localeCompare(b.at)),
        })),
      })),
    }));

  // Planos de la shot list con alguna toma buena (en cualquier día).
  const goodKeys = new Set(
    logs.filter((l) => l.good && l.shotNumber).map((l) => `${norm(l.sceneNumber)}|${norm(l.shotNumber)}`),
  );
  let shotsTotal = 0;
  let shotsWithGood = 0;
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      shotsTotal += 1;
      if (goodKeys.has(`${norm(scene.number)}|${norm(shot.number)}`)) shotsWithGood += 1;
    }
  }

  return {
    days: dayList,
    scenes: scenes.map((sc) => ({
      number: sc.number,
      context: contextOf(sc),
      shots: sc.shots.map((sh) => ({ number: sh.number, size: sh.shotSize, description: sh.description })),
    })),
    shotsTotal,
    shotsWithGood,
  };
}
