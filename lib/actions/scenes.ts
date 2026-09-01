"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import {
  createSceneCore,
  deleteAllScenesCore,
  deleteSceneCore,
  updateSceneCore,
} from "@/lib/scenes-core";

export async function createScene(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const scene = await createSceneCore(projectId, String(formData.get("number") ?? ""));
  if (!scene) return;

  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion/${scene.id}`);
}

export async function updateScene(
  projectId: string,
  sceneId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const breakdownElementIds = formData.getAll("breakdownElementIds").map(String);
  const breakdownConditions: Record<string, string | null> = {};
  for (const id of breakdownElementIds) {
    breakdownConditions[id] = optionalString(formData.get(`condition_${id}`));
  }

  await updateSceneCore(projectId, sceneId, project.organizationId, {
    number: String(formData.get("number") ?? ""),
    intExt: String(formData.get("intExt") ?? ""),
    dayPart: String(formData.get("dayPart") ?? ""),
    locationId: optionalString(formData.get("locationId")),
    storyOrder: (() => {
      const raw = formData.get("storyOrder");
      const num = raw ? Number(raw) : NaN;
      return Number.isFinite(num) ? num : null;
    })(),
    description: optionalString(formData.get("description")),
    action: optionalString(formData.get("action")),
    dialogueNotes: optionalString(formData.get("dialogueNotes")),
    extrasNotes: optionalString(formData.get("extrasNotes")),
    productionNotes: optionalString(formData.get("productionNotes")),
    characterIds: formData.getAll("characterIds").map(String),
    breakdownElementIds,
    breakdownConditions,
    crewMemberIds: formData.getAll("crewMemberIds").map(String),
  });

  revalidatePath(`/app/${projectId}/guion`);
  revalidatePath(`/app/${projectId}/guion/${sceneId}`);
  revalidatePath(`/app/${projectId}/desglose`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
}

export async function deleteScene(projectId: string, sceneId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteSceneCore(projectId, sceneId);
  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion`);
}

export async function deleteAllScenes(projectId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteAllScenesCore(projectId);

  revalidatePath(`/app/${projectId}/guion`);
  revalidatePath(`/app/${projectId}/desglose`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
}
