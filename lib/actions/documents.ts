"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { deleteDocumentCore, uploadDocumentCore } from "@/lib/documents-core";

export async function uploadDocument(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  await uploadDocumentCore(projectId, project.organizationId, {
    file,
    notes: optionalString(formData.get("notes")),
    actorId: optionalString(formData.get("actorId")),
    locationId: optionalString(formData.get("locationId")),
  });

  revalidatePath(`/app/${projectId}/documentos`);
}

export async function deleteDocument(projectId: string, documentId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteDocumentCore(projectId, documentId);
  revalidatePath(`/app/${projectId}/documentos`);
}
