"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import {
  createShootingDayCore,
  deleteShootingDayCore,
  updateDaySceneAssignmentsCore,
  updateShootingDayCore,
} from "@/lib/plan-de-rodaje-core";

export async function createShootingDay(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const date = new Date(String(formData.get("date") ?? ""));
  const result = await createShootingDayCore(projectId, date);
  if (!result) return;

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

export async function assignSceneToDay(
  projectId: string,
  sceneId: string,
  shootingDayId: string | null,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) return;

  await prisma.shootingDayScene.deleteMany({ where: { sceneId } });

  if (shootingDayId) {
    const day = await prisma.shootingDay.findFirst({
      where: { id: shootingDayId, projectId },
    });
    if (!day) return;

    const count = await prisma.shootingDayScene.count({
      where: { shootingDayId },
    });
    await prisma.shootingDayScene.create({
      data: { shootingDayId, sceneId, order: count },
    });
  }

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  revalidatePath(`/app/${projectId}`);
  if (shootingDayId) {
    revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  }
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

  await updateDaySceneAssignmentsCore(projectId, shootingDayId, assignments);

  revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets`);
}
