"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { createShotCore, deleteShotCore, updateShotCore } from "@/lib/shots-core";

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

  await createShotCore(projectId, sceneId, {
    number: String(formData.get("number") ?? "").trim(),
    shotSize: optionalString(formData.get("shotSize")),
    description: optionalString(formData.get("description")),
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

  await updateShotCore(projectId, shotId, {
    number: String(formData.get("number") ?? "").trim(),
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
  });

  revalidatePath(`/app/${projectId}/shot-list`);
  revalidatePath(`/app/${projectId}/shot-list/${shotId}`);
  revalidatePath(`/app/${projectId}/storyboard`);
}

export async function deleteShot(projectId: string, shotId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteShotCore(projectId, shotId);

  revalidatePath(`/app/${projectId}/shot-list`);
  redirect(`/app/${projectId}/shot-list`);
}
