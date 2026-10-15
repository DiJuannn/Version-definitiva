"use server";

import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

export type PaletteScene = { id: string; number: string; slug: string; broken: boolean; planned: boolean };
export type PaletteContext = {
  scenes: PaletteScene[];
  nextDay: { id: string; index: number; date: string; hasSheet: boolean } | null;
};

// Lo que la paleta de comandos necesita para proponer «lo que toca» nada más
// abrirse: las escenas (para saltar a una por su número) y la próxima jornada.
export async function getPaletteContext(projectId: string): Promise<PaletteContext | null> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [scenes, days] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
        _count: { select: { breakdownElements: true, shots: true } },
      },
    }),
    prisma.shootingDay.findMany({
      where: { projectId },
      orderBy: { date: "asc" },
      select: { id: true, date: true, callSheet: { select: { id: true } } },
    }),
  ]);
  const nextIndex = days.findIndex((d) => d.date >= today);
  const next = nextIndex >= 0 ? days[nextIndex] : null;
  return {
    scenes: scenes.map((s) => ({
      id: s.id,
      number: s.number,
      slug: `${INT_EXT_LABELS[s.intExt]}. ${s.location?.name ?? "sin localización"} — ${DAY_PART_LABELS[s.dayPart]}`,
      broken: s._count.breakdownElements > 0,
      planned: s._count.shots > 0,
    })),
    nextDay: next ? { id: next.id, index: nextIndex + 1, date: next.date.toISOString(), hasSheet: Boolean(next.callSheet) } : null,
  };
}
