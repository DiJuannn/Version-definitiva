"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { uploadScriptCore } from "@/lib/script-upload-core";

export type UploadScriptState = { error: string } | undefined;

export async function uploadScript(
  projectId: string,
  _prevState: UploadScriptState,
  formData: FormData,
): Promise<UploadScriptState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "No tienes acceso a este proyecto." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo antes de subir." };
  }

  const result = await uploadScriptCore(projectId, profile.organization.plan, file);
  if ("error" in result) return result;

  revalidatePath(`/app/${projectId}/guion`);
  return undefined;
}

export async function deleteScriptFile(
  projectId: string,
  scriptFileId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.scriptFile.deleteMany({
    where: { id: scriptFileId, projectId },
  });

  revalidatePath(`/app/${projectId}/guion`);
}
