"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { logActivity } from "@/lib/activity-log";
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

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `añadió el personaje ${name}`);

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

  const character = await prisma.character.findFirst({
    where: { id: characterId, projectId },
    select: { name: true },
  });
  await deleteCharacterCore(projectId, characterId);

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `eliminó el personaje ${character?.name ?? ""}`);

  revalidatePath(`/app/${projectId}/personajes`);
}
