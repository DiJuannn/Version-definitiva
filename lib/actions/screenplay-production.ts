"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { sceneStatus, SCENE_STATUS_SELECT, type SceneStatus } from "@/lib/scene-status";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";

export type ProductionScene = {
  sceneId: string;
  status: SceneStatus;
  breakdown: { name: string; category: string }[];
  shots: number;
  days: string[]; // "Día 2"
};

export type ScreenplayProduction = {
  projectId: string;
  days: { count: number; first: string | null; last: string | null };
  scenes: Record<string, ProductionScene>; // por sid de la escena del guion
};

// Lo que el proyecto vinculado sabe de cada escena del guion (desglose,
// planos, día de rodaje), para la tira viva y la radiografía del editor.
export async function getScreenplayProduction(screenplayId: string): Promise<ScreenplayProduction | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const sp = await prisma.screenplay.findFirst({
    where: { id: screenplayId, organizationId: profile.organizationId },
    select: { projectId: true },
  });
  if (!sp?.projectId) return null;
  const projectId = sp.projectId;

  const [days, scenes] = await Promise.all([
    prisma.shootingDay.findMany({ where: { projectId }, orderBy: { date: "asc" }, select: { id: true, date: true } }),
    prisma.scene.findMany({
      where: { projectId, scriptSid: { not: null } },
      select: {
        id: true,
        scriptSid: true,
        ...SCENE_STATUS_SELECT,
        breakdownElements: { select: { breakdownElement: { select: { name: true, category: true } } } },
        shootingDayScenes: { select: { shootingDayId: true } },
      },
    }),
  ]);
  const dayIndex = new Map(days.map((d, i) => [d.id, i + 1]));

  return {
    projectId,
    days: {
      count: days.length,
      first: days[0]?.date.toISOString() ?? null,
      last: days[days.length - 1]?.date.toISOString() ?? null,
    },
    scenes: Object.fromEntries(
      scenes.map((s) => {
        const dayIds = new Set([...s.shootingDayScenes.map((d) => d.shootingDayId), ...s.shots.map((sh) => sh.shootingDayId).filter((d): d is string => Boolean(d))]);
        return [
          s.scriptSid as string,
          {
            sceneId: s.id,
            status: sceneStatus(s),
            breakdown: s.breakdownElements.map((b) => ({ name: b.breakdownElement.name, category: BREAKDOWN_CATEGORY_LABELS[b.breakdownElement.category] })),
            shots: s.shots.length,
            days: [...dayIds].map((id) => dayIndex.get(id)).filter((n): n is number => n !== undefined).sort((a, b) => a - b).map((n) => `Día ${n}`),
          },
        ];
      }),
    ),
  };
}
