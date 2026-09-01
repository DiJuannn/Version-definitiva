"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalDecimal, optionalString } from "@/lib/form-utils";
import { createActorCore, deleteActorCore } from "@/lib/personajes-core";

export async function createActor(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await createActorCore(projectId, project.organizationId, {
    personId: optionalString(formData.get("personId")),
    name: optionalString(formData.get("name")),
    email: optionalString(formData.get("email")),
    phone: optionalString(formData.get("phone")),
    rate: optionalDecimal(formData.get("rate")),
    availability: optionalString(formData.get("availability")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath(`/app/${projectId}/personajes`);
}

export async function deleteActor(projectId: string, actorId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteActorCore(projectId, actorId);
  revalidatePath(`/app/${projectId}/personajes`);
}
