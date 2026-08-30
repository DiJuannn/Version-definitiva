"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteProjectFile, uploadProjectFile } from "@/lib/storage";

// Un único guion "actual" por proyecto: subir uno nuevo reemplaza al
// anterior en vez de acumularlo, ya que nada en la app usa un historial de
// versiones de guion todavía.
export async function uploadScript(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const uploaded = await uploadProjectFile(projectId, file);
  if (!uploaded) return;

  const previous = await prisma.scriptFile.findMany({ where: { projectId } });

  await prisma.scriptFile.create({
    data: { projectId, fileUrl: uploaded.url, fileName: uploaded.name },
  });

  if (previous.length > 0) {
    await prisma.scriptFile.deleteMany({
      where: { id: { in: previous.map((p) => p.id) } },
    });
    await Promise.all(previous.map((p) => deleteProjectFile(p.fileUrl)));
  }

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
