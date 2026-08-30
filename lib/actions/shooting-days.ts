"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";

export async function createShootingDay(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const dateInput = String(formData.get("date") ?? "");
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return;

  const day = await prisma.shootingDay.create({
    data: { projectId, date },
  });

  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  redirect(`/app/${projectId}/plan-de-rodaje/${day.id}`);
}

export async function updateShootingDay(
  projectId: string,
  shootingDayId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const dateInput = String(formData.get("date") ?? "");
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return;

  await prisma.shootingDay.updateMany({
    where: { id: shootingDayId, projectId },
    data: { date, notes: optionalString(formData.get("notes")) },
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

  await prisma.shootingDay.deleteMany({
    where: { id: shootingDayId, projectId },
  });

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

  const day = await prisma.shootingDay.findFirst({
    where: { id: shootingDayId, projectId },
  });
  if (!day) return;

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
        shootingDayId,
        sceneId: scene.id,
        callTime,
        order: Number.isFinite(order) ? order : index,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  await prisma.$transaction([
    prisma.shootingDayScene.deleteMany({ where: { shootingDayId } }),
    prisma.shootingDayScene.createMany({ data: assignments }),
  ]);

  revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets`);
}
