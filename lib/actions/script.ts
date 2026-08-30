"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { uploadProjectFile } from "@/lib/storage";

export async function uploadScript(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const uploaded = await uploadProjectFile(projectId, file);
  if (!uploaded) return;

  await prisma.scriptFile.create({
    data: { projectId, fileUrl: uploaded.url, fileName: uploaded.name },
  });

  revalidatePath(`/app/${projectId}/guion`);
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
