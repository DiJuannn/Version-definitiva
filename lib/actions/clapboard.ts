"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { logClapCore } from "@/lib/clapboard-core";

export type LogClapState = { error: string } | { success: true; id: string } | undefined;

// El aviso visual/sonoro del clap se dispara en el cliente, sin esperar a
// esto — este guardado es solo para dejar constancia en el historial.
// Por eso no hace falta useActionState aquí: se llama directamente desde
// el cliente sin bloquear la animación.
export async function logClap(
  projectId: string,
  formData: FormData,
): Promise<LogClapState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const result = await logClapCore(projectId, {
    sceneId: optionalString(formData.get("sceneId")),
    sceneNumber: String(formData.get("sceneNumber") ?? ""),
    shotNumber: optionalString(formData.get("shotNumber")),
    take: Number(formData.get("take")),
    director: optionalString(formData.get("director")),
    camera: optionalString(formData.get("camera")),
    intExt: optionalString(formData.get("intExt")),
    dayPart: optionalString(formData.get("dayPart")),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/app/${projectId}/claqueta`);
  return { success: true, id: result.id };
}

export async function deleteClapLog(projectId: string, clapLogId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.clapLog.deleteMany({ where: { id: clapLogId, projectId } });
  revalidatePath(`/app/${projectId}/claqueta`);
}
