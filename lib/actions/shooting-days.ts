"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { logActivity } from "@/lib/activity-log";
import { notifyCallSheetChange } from "@/lib/call-sheet-change-alert";
import { updateDayItemReservations } from "@/lib/actions/inventory";
import { updateDayVehicleReservations } from "@/lib/actions/vehicles";
import {
  assignShotToDayCore,
  createShootingDayCore,
  deleteShootingDayCore,
  moveSceneChunkCore,
  setShotDoneCore,
  updateDaySceneAssignmentsCore,
  updateShootingDayCore,
} from "@/lib/plan-de-rodaje-core";

export async function createShootingDay(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const date = new Date(String(formData.get("date") ?? ""));
  const result = await createShootingDayCore(projectId, date);
  if (!result) return;

  const profile = await getCurrentProfile();
  await logActivity(
    projectId,
    profile?.id,
    `añadió un día de rodaje (${date.toLocaleDateString("es-ES")})`,
  );

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  redirect(`/app/${projectId}/plan-de-rodaje/${result.id}`);
}

export async function updateShootingDay(
  projectId: string,
  shootingDayId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateShootingDayCore(projectId, shootingDayId, {
    date: new Date(String(formData.get("date") ?? "")),
    notes: optionalString(formData.get("notes")),
  });
  await notifyCallSheetChange(projectId, shootingDayId);

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
}

export async function deleteShootingDay(
  projectId: string,
  shootingDayId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteShootingDayCore(projectId, shootingDayId);

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  redirect(`/app/${projectId}/plan-de-rodaje`);
}

// Mueve un trozo de escena entre columnas del tablero: todos los planos de la
// escena que estaban en `fromDayId` (null = sin asignar) pasan a `shootingDayId`.
export async function assignSceneToDay(
  projectId: string,
  sceneId: string,
  shootingDayId: string | null,
  fromDayId: string | null = null,
): Promise<boolean> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return false;

  const ok = await moveSceneChunkCore(projectId, sceneId, fromDayId, shootingDayId);
  if (!ok) return false;

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}`);
  if (shootingDayId) revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  if (fromDayId) revalidatePath(`/app/${projectId}/plan-de-rodaje/${fromDayId}`);
  return true;
}

// Un plano suelto a otro día (selector del tablero).
export async function assignShotToDay(
  projectId: string,
  shotId: string,
  shootingDayId: string | null,
): Promise<boolean> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return false;

  const before = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
    select: { shootingDayId: true },
  });
  const result = await assignShotToDayCore(projectId, shotId, shootingDayId);
  if (!result) return false;

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}`);
  if (shootingDayId) revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  if (before?.shootingDayId) revalidatePath(`/app/${projectId}/plan-de-rodaje/${before.shootingDayId}`);
  return true;
}

export async function setShotDone(projectId: string, shotId: string, done: boolean): Promise<boolean> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return false;

  const ok = await setShotDoneCore(projectId, shotId, done);
  if (ok) {
    revalidatePath(`/app/${projectId}/plan-de-rodaje`);
    revalidatePath(`/app/${projectId}`);
  }
  return ok;
}

export async function updateDaySceneAssignments(
  projectId: string,
  shootingDayId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    select: { id: true },
  });

  const assignments = scenes
    .map((scene, index) => {
      const checked = formData.get(`assign_${scene.id}`);
      if (!checked) return null;
      const callTime = optionalString(formData.get(`callTime_${scene.id}`));
      const orderInput = formData.get(`order_${scene.id}`);
      const order = orderInput ? Number(orderInput) : index;
      return {
        sceneId: scene.id,
        callTime,
        order: Number.isFinite(order) ? order : index,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // El planificador del día manda una marca `planner` y un `shot_<id>` por plano
  // seleccionado (y `done_<id>` si ya está rodado). Sin la marca, los planos no se tocan.
  let shotIds: string[] | undefined;
  let doneShotIds: string[] | undefined;
  if (formData.get("planner")) {
    const shots = await prisma.shot.findMany({
      where: { scene: { projectId } },
      select: { id: true },
    });
    shotIds = shots.filter((sh) => formData.get(`shot_${sh.id}`)).map((sh) => sh.id);
    doneShotIds = shots.filter((sh) => formData.get(`done_${sh.id}`)).map((sh) => sh.id);
  }

  await updateDaySceneAssignmentsCore(projectId, shootingDayId, { assignments, shotIds, doneShotIds });

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `actualizó las escenas y planos del plan de rodaje`);
  await notifyCallSheetChange(projectId, shootingDayId);

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets`);
}

// Un solo "Guardar" para todo lo que se edita en la página del día: escenas
// (con hora y orden), material y vehículos. Antes eran tres formularios con
// tres botones, y guardar uno descartaba lo editado en los otros.
export async function saveDayPlan(
  projectId: string,
  shootingDayId: string,
  formData: FormData,
) {
  await updateDaySceneAssignments(projectId, shootingDayId, formData);
  await updateDayItemReservations(projectId, shootingDayId, formData);
  await updateDayVehicleReservations(projectId, shootingDayId, formData);
}
