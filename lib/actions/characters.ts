"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import {
  createCharacterCore,
  deleteCharacterCore,
  updateCharacterActorCore,
} from "@/lib/personajes-core";

export async function createCharacter(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await createCharacterCore(projectId, {
    name,
    actorId: optionalString(formData.get("actorId")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath(`/app/${projectId}/personajes`);
}

export async function updateCharacterActor(
  projectId: string,
  characterId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateCharacterActorCore(projectId, characterId, optionalString(formData.get("actorId")));
  revalidatePath(`/app/${projectId}/personajes`);
}

export async function deleteCharacter(projectId: string, characterId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteCharacterCore(projectId, characterId);
  revalidatePath(`/app/${projectId}/personajes`);
}
