"use server";

import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getScenesText, type SceneTextBlock } from "@/lib/scene-text";
import { sceneStatus, SCENE_STATUS_SELECT, type SceneStatus } from "@/lib/scene-status";
import { BREAKDOWN_CATEGORY_LABELS, DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

export type ScenePeekData = {
  id: string;
  number: string;
  index: number;
  total: number;
  prevId: string | null;
  nextId: string | null;
  intExt: string;
  intExtLabel: string;
  dayPart: string;
  dayPartLabel: string;
  location: { id: string; name: string } | null;
  status: SceneStatus;
  blocks: SceneTextBlock[];
  textSource: "guion" | "ficha";
  cast: { id: string; name: string; actor: string | null }[];
  breakdown: { category: string; label: string; items: string[] }[];
  shots: { id: string; number: string; shotSize: string | null; description: string | null; done: boolean; durationSec: number | null }[];
  days: { id: string; date: string; index: number }[];
};

// Todo lo de una escena en una sola lectura, para la ficha rápida que se abre
// desde cualquier herramienta del proyecto.
export async function getScenePeek(projectId: string, sceneId: string): Promise<ScenePeekData | null> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return null;
  const [all, scene, days] = await Promise.all([
    prisma.scene.findMany({ where: { projectId }, orderBy: [{ order: "asc" }, { number: "asc" }], select: { id: true } }),
    prisma.scene.findFirst({
      where: { id: sceneId, projectId },
      include: {
        location: { select: { id: true, name: true } },
        characters: { select: { character: { select: { id: true, name: true, actor: { select: { name: true } } } } }, orderBy: { character: { name: "asc" } } },
        breakdownElements: { select: { breakdownElement: { select: { name: true, category: true } } } },
        shots: { orderBy: [{ order: "asc" }, { number: "asc" }], select: { id: true, number: true, shotSize: true, description: true, done: true, durationSec: true, shootingDayId: true } },
        shootingDayScenes: { select: { shootingDayId: true } },
        ...{ _count: SCENE_STATUS_SELECT._count },
      },
    }),
    prisma.shootingDay.findMany({ where: { projectId }, orderBy: { date: "asc" }, select: { id: true, date: true } }),
  ]);
  if (!scene) return null;

  const index = all.findIndex((s) => s.id === scene.id);
  const text = (await getScenesText(projectId, [scene])).get(scene.id);
  const byCategory = new Map<string, string[]>();
  for (const { breakdownElement: e } of scene.breakdownElements) {
    byCategory.set(e.category, [...(byCategory.get(e.category) ?? []), e.name]);
  }
  const dayIds = new Set([...scene.shots.map((s) => s.shootingDayId).filter(Boolean), ...scene.shootingDayScenes.map((d) => d.shootingDayId)]);

  return {
    id: scene.id,
    number: scene.number,
    index,
    total: all.length,
    prevId: all[index - 1]?.id ?? null,
    nextId: all[index + 1]?.id ?? null,
    intExt: scene.intExt,
    intExtLabel: INT_EXT_LABELS[scene.intExt],
    dayPart: scene.dayPart,
    dayPartLabel: DAY_PART_LABELS[scene.dayPart],
    location: scene.location,
    status: sceneStatus(scene),
    blocks: text?.blocks ?? [],
    textSource: text?.source ?? "ficha",
    cast: scene.characters.map((c) => ({ id: c.character.id, name: c.character.name, actor: c.character.actor?.name ?? null })),
    breakdown: [...byCategory].map(([category, items]) => ({
      category,
      label: BREAKDOWN_CATEGORY_LABELS[category as keyof typeof BREAKDOWN_CATEGORY_LABELS] ?? category,
      items,
    })),
    shots: scene.shots.map((s) => ({ id: s.id, number: s.number, shotSize: s.shotSize, description: s.description, done: s.done, durationSec: s.durationSec })),
    days: days.map((d, i) => ({ id: d.id, date: d.date.toISOString(), index: i + 1 })).filter((d) => dayIds.has(d.id)),
  };
}
