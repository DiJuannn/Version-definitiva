"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";

export async function createCharacter(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const actorId = optionalString(formData.get("actorId"));

  await prisma.character.create({
    data: {
      projectId,
      name,
      actorId: actorId ?? undefined,
      notes: optionalString(formData.get("notes")),
    },
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

  const actorId = optionalString(formData.get("actorId"));

  await prisma.character.updateMany({
    where: { id: characterId, projectId },
    data: { actorId: actorId ?? null },
  });

  revalidatePath(`/app/${projectId}/personajes`);
}

export async function deleteCharacter(projectId: string, characterId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.character.deleteMany({ where: { id: characterId, projectId } });
  revalidatePath(`/app/${projectId}/personajes`);
}
