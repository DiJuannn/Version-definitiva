"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";

function optionalInt(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const num = Number.parseInt(str, 10);
  return Number.isFinite(num) ? num : null;
}

export async function createShot(
  projectId: string,
  sceneId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId },
  });
  if (!scene) return;

  const number = String(formData.get("number") ?? "").trim();
  if (!number) return;

  const count = await prisma.shot.count({ where: { sceneId } });
  await prisma.shot.create({
    data: {
      sceneId,
      number,
      shotSize: optionalString(formData.get("shotSize")),
      description: optionalString(formData.get("description")),
      order: count,
    },
  });

  revalidatePath(`/app/${projectId}/shot-list`);
}

export async function updateShot(
  projectId: string,
  shotId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
  });
  if (!shot) return;

  const number = String(formData.get("number") ?? "").trim();
  if (!number) return;

  await prisma.shot.update({
    where: { id: shotId },
    data: {
      number,
      shotType: optionalString(formData.get("shotType")),
      shotSize: optionalString(formData.get("shotSize")),
      angle: optionalString(formData.get("angle")),
      movement: optionalString(formData.get("movement")),
      camera: optionalString(formData.get("camera")),
      lens: optionalString(formData.get("lens")),
      fps: optionalInt(formData.get("fps")),
      durationSec: optionalInt(formData.get("durationSec")),
      description: optionalString(formData.get("description")),
      audio: optionalString(formData.get("audio")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath(`/app/${projectId}/shot-list`);
  revalidatePath(`/app/${projectId}/shot-list/${shotId}`);
  revalidatePath(`/app/${projectId}/storyboard`);
}

export async function deleteShot(projectId: string, shotId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.shot.deleteMany({
    where: { id: shotId, scene: { projectId } },
  });

  revalidatePath(`/app/${projectId}/shot-list`);
  redirect(`/app/${projectId}/shot-list`);
}
