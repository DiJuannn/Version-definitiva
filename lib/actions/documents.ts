"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { uploadProjectFile } from "@/lib/storage";

export async function uploadDocument(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const uploaded = await uploadProjectFile(projectId, file);
  if (!uploaded) return;

  const actorId = optionalString(formData.get("actorId"));
  const locationId = optionalString(formData.get("locationId"));

  const [actor, location] = await Promise.all([
    actorId ? prisma.actor.findFirst({ where: { id: actorId, projectId } }) : null,
    locationId
      ? prisma.location.findFirst({
          where: { id: locationId, organizationId: project.organizationId },
        })
      : null,
  ]);

  await prisma.document.create({
    data: {
      projectId,
      fileUrl: uploaded.url,
      fileName: uploaded.name,
      notes: optionalString(formData.get("notes")),
      actorId: actor?.id,
      locationId: location?.id,
    },
  });

  revalidatePath(`/app/${projectId}/documentos`);
}

export async function deleteDocument(projectId: string, documentId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.document.deleteMany({ where: { id: documentId, projectId } });
  revalidatePath(`/app/${projectId}/documentos`);
}
