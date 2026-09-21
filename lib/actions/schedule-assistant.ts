"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { logActivity } from "@/lib/activity-log";
import {
  applyScheduleProposal,
  buildScheduleProposal,
  summarizeProposal,
  type ScheduleParams,
} from "@/lib/schedule-assistant-core";

export type { ScheduleParams };
export type ScheduleProposal =
  | { ok: true; days: { date: string; scenes: { id: string; label: string }[]; locations: string[] }[]; totalScenes: number }
  | { ok: false; error: string };

// Solo calcula: no guarda nada.
export async function previewSchedule(projectId: string, params: ScheduleParams): Promise<ScheduleProposal> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const result = await buildScheduleProposal(projectId, params);
  if ("error" in result) return { ok: false, error: result.error };
  return { ok: true, ...summarizeProposal(result.days) };
}

export async function applySchedule(
  projectId: string,
  params: ScheduleParams,
): Promise<{ ok: true; days: number } | { ok: false; error: string }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const result = await applyScheduleProposal(projectId, params);
  if (!result.ok) return result;

  const profile = await getCurrentProfile();
  await logActivity(
    projectId,
    profile?.id,
    `creó un plan de rodaje de ${result.days} día${result.days === 1 ? "" : "s"} con el asistente`,
  );
  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}`);
  return result;
}
