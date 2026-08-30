"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalDecimal, optionalString } from "@/lib/form-utils";

export async function createActor(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const personId = optionalString(formData.get("personId"));
  const person = personId
    ? await prisma.person.findFirst({
        where: { id: personId, organizationId: project.organizationId },
      })
    : null;

  const typedName = String(formData.get("name") ?? "").trim();
  const name =
    typedName || (person ? `${person.firstName} ${person.lastName ?? ""}`.trim() : "");
  if (!name) return;

  await prisma.actor.create({
    data: {
      projectId,
      personId: person?.id,
      name,
      email: optionalString(formData.get("email")) ?? person?.email ?? null,
      phone: optionalString(formData.get("phone")) ?? person?.phone ?? null,
      rate:
        optionalDecimal(formData.get("rate")) ??
        (person?.rate ? Number(person.rate) : null),
      availability: optionalString(formData.get("availability")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath(`/app/${projectId}/personajes`);
}

export async function deleteActor(projectId: string, actorId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.actor.deleteMany({ where: { id: actorId, projectId } });
  revalidatePath(`/app/${projectId}/personajes`);
}
