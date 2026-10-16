// En qué punto está cada escena, en los cuatro pasos que la llevan del guion
// a la pantalla: desglosada (se sabe qué hace falta), planificada (tiene
// planos), programada (todos sus planos tienen día) y rodada (todos sus
// planos están rodados). Lo pintan SceneProgress y la ficha rápida.

import { prisma } from "@/lib/prisma";

export type SceneStatus = { broken: boolean; planned: boolean; scheduled: boolean; shot: boolean };

export const SCENE_STEPS: { key: keyof SceneStatus; label: string; color: string }[] = [
  { key: "broken", label: "Desglosada", color: "var(--phase-1)" },
  { key: "planned", label: "Con planos", color: "var(--phase-2)" },
  { key: "scheduled", label: "Con día de rodaje", color: "var(--phase-3)" },
  { key: "shot", label: "Rodada", color: "var(--phase-4)" },
];

type SceneForStatus = {
  _count: { breakdownElements: number; shootingDayScenes: number };
  shots: { shootingDayId: string | null; done: boolean }[];
};

export function sceneStatus(s: SceneForStatus): SceneStatus {
  const shots = s.shots;
  return {
    broken: s._count.breakdownElements > 0,
    planned: shots.length > 0,
    scheduled: shots.length > 0 ? shots.every((sh) => sh.shootingDayId) : s._count.shootingDayScenes > 0,
    shot: shots.length > 0 && shots.every((sh) => sh.done),
  };
}

// Selección de Prisma para poder calcular el estado.
export const SCENE_STATUS_SELECT = {
  _count: { select: { breakdownElements: true, shootingDayScenes: true } },
  shots: { select: { shootingDayId: true, done: true } },
} as const;

export async function getSceneStatuses(projectId: string): Promise<Map<string, SceneStatus>> {
  const scenes = await prisma.scene.findMany({ where: { projectId }, select: { id: true, ...SCENE_STATUS_SELECT } });
  return new Map(scenes.map((s) => [s.id, sceneStatus(s)]));
}

export const EMPTY_STATUS: SceneStatus = { broken: false, planned: false, scheduled: false, shot: false };
