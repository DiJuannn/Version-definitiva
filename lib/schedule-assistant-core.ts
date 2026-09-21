import { prisma } from "@/lib/prisma";
import { createShootingDayCore, moveSceneChunkCore } from "@/lib/plan-de-rodaje-core";
import { isValidDateKey, suggestSchedule, type SuggestedDay } from "@/lib/schedule-suggest";

// Compartido por la Server Action de la web (lib/actions/schedule-assistant.ts) y la ruta de la app móvil.

export type ScheduleParams = { startDate: string; perDay: number; weekendsOnly: boolean };

export async function buildScheduleProposal(
  projectId: string,
  params: ScheduleParams,
): Promise<{ days: SuggestedDay[] } | { error: string }> {
  if (!isValidDateKey(params.startDate)) return { error: "Elige la fecha en la que quieres empezar a rodar." };
  if (!Number.isFinite(params.perDay) || params.perDay < 1 || params.perDay > 12) {
    return { error: "Las escenas por día tienen que estar entre 1 y 12." };
  }
  const [scenes, days] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId, shootingDayScenes: { none: {} }, shots: { none: { shootingDayId: { not: null } } } },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: { id: true, number: true, intExt: true, dayPart: true, locationId: true, location: { select: { name: true } } },
    }),
    prisma.shootingDay.findMany({ where: { projectId }, select: { date: true } }),
  ]);
  if (scenes.length === 0) return { error: "Todas las escenas ya tienen día de rodaje." };
  const proposal = suggestSchedule(
    scenes.map((s) => ({
      id: s.id,
      number: s.number,
      intExt: s.intExt,
      dayPart: s.dayPart,
      locationId: s.locationId,
      locationName: s.location?.name ?? null,
    })),
    { ...params, takenDates: days.map((d) => d.date.toISOString().slice(0, 10)) },
  );
  return { days: proposal };
}

// Forma que se enseña (y que recibe la app): sin datos internos de las escenas.
export function summarizeProposal(days: SuggestedDay[]) {
  return {
    totalScenes: days.reduce((n, d) => n + d.scenes.length, 0),
    days: days.map((d) => ({
      date: d.date,
      locations: d.locations,
      scenes: d.scenes.map((s) => ({ id: s.id, label: s.number })),
    })),
  };
}

// Crea las jornadas de la propuesta y reparte las escenas (la misma propuesta, recalculada con los mismos datos).
export async function applyScheduleProposal(
  projectId: string,
  params: ScheduleParams,
): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const result = await buildScheduleProposal(projectId, params);
  if ("error" in result) return { ok: false, error: result.error };
  for (const day of result.days) {
    const created = await createShootingDayCore(projectId, new Date(day.date));
    if (!created) return { ok: false, error: "No se pudo crear una de las jornadas." };
    for (const scene of day.scenes) {
      await moveSceneChunkCore(projectId, scene.id, null, created.id);
    }
  }
  return { ok: true, days: result.days.length };
}
