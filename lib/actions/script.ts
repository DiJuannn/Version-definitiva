"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { deleteProjectFile, uploadProjectFile } from "@/lib/storage";
import { countDocumentPages } from "@/lib/document-pages";
import { SCRIPT_PAGE_LIMIT_FREE, SCRIPT_PAGE_LIMIT_PRO } from "@/lib/limits";

export type UploadScriptState = { error: string } | undefined;

// Un único guion "actual" por proyecto: subir uno nuevo reemplaza al
// anterior en vez de acumularlo, ya que nada en la app usa un historial de
// versiones de guion todavía.
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

  const pageLimit =
    profile.organization.plan === "PRO" ? SCRIPT_PAGE_LIMIT_PRO : SCRIPT_PAGE_LIMIT_FREE;
  const pageCount = await countDocumentPages(file);
  if (pageCount !== null && pageCount > pageLimit) {
    return {
      error:
        profile.organization.plan === "PRO"
          ? `Este guion tiene ${pageCount} páginas — el máximo por análisis es ${pageLimit}.`
          : `Este guion tiene ${pageCount} páginas — el plan gratuito permite hasta ${pageLimit}. Pásate a PRO para guiones más largos.`,
    };
  }

  const uploaded = await uploadProjectFile(projectId, file);
  if (!uploaded) {
    return {
      error: "No se pudo subir el archivo. Comprueba tu conexión e inténtalo de nuevo.",
    };
  }

  const previous = await prisma.scriptFile.findMany({ where: { projectId } });

  try {
    await prisma.scriptFile.create({
      data: { projectId, fileUrl: uploaded.url, fileName: uploaded.name },
    });
  } catch {
    return { error: "No se pudo guardar el guion. Inténtalo de nuevo." };
  }

  if (previous.length > 0) {
    await prisma.scriptFile.deleteMany({
      where: { id: { in: previous.map((p) => p.id) } },
    });
    // allSettled a propósito: el guion nuevo ya quedó guardado (lo
    // importante), así que si falla borrar el archivo antiguo del
    // almacenamiento no debe tirar abajo toda la subida.
    await Promise.allSettled(previous.map((p) => deleteProjectFile(p.fileUrl)));
  }

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
