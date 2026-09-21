"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { logActivity } from "@/lib/activity-log";
import { createShootingDayCore, moveSceneChunkCore } from "@/lib/plan-de-rodaje-core";
import { isValidDateKey, suggestSchedule, type SuggestedDay } from "@/lib/schedule-suggest";

export type ScheduleParams = { startDate: string; perDay: number; weekendsOnly: boolean };
export type ScheduleProposal =
  | { ok: true; days: { date: string; scenes: { id: string; label: string }[]; locations: string[] }[]; totalScenes: number }
  | { ok: false; error: string };

async function buildProposal(
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

// Solo calcula: no guarda nada.
export async function previewSchedule(projectId: string, params: ScheduleParams): Promise<ScheduleProposal> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const result = await buildProposal(projectId, params);
  if ("error" in result) return { ok: false, error: result.error };
  return {
    ok: true,
    totalScenes: result.days.reduce((n, d) => n + d.scenes.length, 0),
    days: result.days.map((d) => ({
      date: d.date,
      locations: d.locations,
      scenes: d.scenes.map((s) => ({ id: s.id, label: s.number })),
    })),
  };
}

// Crea las jornadas de la propuesta y reparte las escenas (misma propuesta, recalculada con los mismos datos).
export async function applySchedule(
  projectId: string,
  params: ScheduleParams,
): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const result = await buildProposal(projectId, params);
  if ("error" in result) return { ok: false, error: result.error };

  for (const day of result.days) {
    const created = await createShootingDayCore(projectId, new Date(day.date));
    if (!created) return { ok: false, error: "No se pudo crear una de las jornadas." };
    for (const scene of day.scenes) {
      await moveSceneChunkCore(projectId, scene.id, null, created.id);
    }
  }

  const profile = await getCurrentProfile();
  await logActivity(
    projectId,
    profile?.id,
    `creó un plan de rodaje de ${result.days.length} día${result.days.length === 1 ? "" : "s"} con el asistente`,
  );
  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}`);
  return { ok: true, days: result.days.length };
}
