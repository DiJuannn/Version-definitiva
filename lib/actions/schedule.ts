"use server";

import { revalidatePath } from "next/cache";
import type { ScheduleBlockKind } from "@/lib/generated/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import {
  createBlockCore,
  deleteBlockCore,
  markRetakeCore,
  moveBlockCore,
  placeSceneCore,
  placeShotsCore,
  setDayTimesCore,
  setShotEstimateCore,
  setWorkdayHoursCore,
  updateBlockCore,
  type ShotTarget,
} from "@/lib/schedule-core";
import { parseHHMM } from "@/lib/schedule-plan";

// Acciones del editor de jornada (orden de rodaje). Devuelven true/false para
// que el editor deshaga su cambio optimista si algo falla.

function refresh(projectId: string) {
  revalidatePath(`/app/${projectId}/plan-de-rodaje`, "layout");
  revalidatePath(`/app/${projectId}/call-sheets`, "layout");
  revalidatePath(`/app/${projectId}/shot-list`);
  revalidatePath(`/app/${projectId}`);
}

async function allowed(projectId: string) {
  return Boolean(await getProjectForCurrentUser(projectId));
}

export async function placeShots(projectId: string, shotIds: string[], target: ShotTarget): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const ok = await placeShotsCore(projectId, shotIds, target);
  if (ok) refresh(projectId);
  return ok;
}

export async function placeScene(projectId: string, sceneId: string, target: { dayId: string; index?: number } | null) {
  if (!(await allowed(projectId))) return false;
  const ok = await placeSceneCore(projectId, sceneId, target);
  if (ok) refresh(projectId);
  return ok;
}

export async function createBlock(
  projectId: string,
  dayId: string,
  kind: ScheduleBlockKind,
  title: string | null,
  durationMin: number | null,
): Promise<string | null> {
  if (!(await allowed(projectId))) return null;
  const id = await createBlockCore(projectId, dayId, { kind, title, durationMin });
  if (id) refresh(projectId);
  return id;
}

export async function updateBlock(
  projectId: string,
  blockId: string,
  patch: { title?: string | null; durationMin?: number | null; startTime?: string | null; notes?: string | null },
): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const clean = { ...patch };
  if ("startTime" in clean && clean.startTime && parseHHMM(clean.startTime) === null) return false;
  if ("durationMin" in clean && clean.durationMin !== null && clean.durationMin !== undefined) {
    if (!Number.isFinite(clean.durationMin) || clean.durationMin < 0 || clean.durationMin > 24 * 60) return false;
    clean.durationMin = Math.round(clean.durationMin) || null;
  }
  if ("title" in clean) clean.title = clean.title?.trim() || null;
  const ok = await updateBlockCore(projectId, blockId, clean);
  if (ok) refresh(projectId);
  return ok;
}

export async function deleteBlock(projectId: string, blockId: string): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const ok = await deleteBlockCore(projectId, blockId);
  if (ok) refresh(projectId);
  return ok;
}

export async function moveBlock(projectId: string, blockId: string, toDayId: string, index: number): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const ok = await moveBlockCore(projectId, blockId, toDayId, index);
  if (ok) refresh(projectId);
  return ok;
}

export async function setShotEstimate(projectId: string, shotId: string, minutes: number | null): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const ok = await setShotEstimateCore(projectId, shotId, minutes);
  if (ok) refresh(projectId);
  return ok;
}

export async function markRetake(projectId: string, shotId: string, note: string | null): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const ok = await markRetakeCore(projectId, shotId, note);
  if (ok) refresh(projectId);
  return ok;
}

export async function setDayTimes(projectId: string, dayId: string, callTime: string | null, prepMin: number | null) {
  if (!(await allowed(projectId))) return false;
  const time = callTime?.trim() || null;
  if (time && parseHHMM(time) === null) return false;
  const normalized = time ? time.replace(/[.h]/, ":").padStart(5, "0") : null;
  const prep = prepMin !== null && Number.isFinite(prepMin) && prepMin >= 0 && prepMin <= 300 ? Math.round(prepMin) : null;
  const ok = await setDayTimesCore(projectId, dayId, { callTime: normalized, prepMin: prep });
  if (ok) refresh(projectId);
  return ok;
}

export async function setWorkdayHours(projectId: string, hours: number): Promise<boolean> {
  if (!(await allowed(projectId))) return false;
  const ok = await setWorkdayHoursCore(projectId, hours);
  if (ok) refresh(projectId);
  return ok;
}
