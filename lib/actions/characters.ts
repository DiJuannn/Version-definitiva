"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { logActivity } from "@/lib/activity-log";
import { notifyActorOfScenes } from "@/lib/actor-scene-notifications";
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

  const actorId = optionalString(formData.get("actorId"));
  const characterId = await createCharacterCore(projectId, {
    name,
    actorId,
    notes: optionalString(formData.get("notes")),
  });

  if (characterId && actorId) {
    await notifyActorOfScenes(projectId, characterId);
  }

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

  const newActorId = optionalString(formData.get("actorId"));

  const before = await prisma.character.findFirst({
    where: { id: characterId, projectId },
    select: { actorId: true },
  });

  await updateCharacterActorCore(projectId, characterId, newActorId);

  // Solo avisa al actor cuando pasa a estar asignado de verdad (no al
  // quitarlo, ni si ya estaba asignado y se guarda el mismo).
  if (newActorId && newActorId !== before?.actorId) {
    await notifyActorOfScenes(projectId, characterId);
  }

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
