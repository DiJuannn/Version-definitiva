"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { DayPart, IntExt } from "@/lib/generated/prisma";

export type LogClapState = { error: string } | { success: true } | undefined;

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

  const sceneId = optionalString(formData.get("sceneId"));
  const sceneNumber = String(formData.get("sceneNumber") ?? "").trim();
  const take = Number(formData.get("take"));
  const roll = optionalString(formData.get("roll"));
  const camera = optionalString(formData.get("camera"));
  const intExtInput = optionalString(formData.get("intExt"));
  const dayPartInput = optionalString(formData.get("dayPart"));

  if (!sceneNumber || !Number.isFinite(take) || take < 1) {
    return { error: "Falta el número de escena o la toma no es válida." };
  }

  const intExt = (Object.values(IntExt) as string[]).includes(intExtInput ?? "")
    ? (intExtInput as IntExt)
    : null;
  const dayPart = (Object.values(DayPart) as string[]).includes(dayPartInput ?? "")
    ? (dayPartInput as DayPart)
    : null;

  await prisma.clapLog.create({
    data: {
      projectId,
      sceneId: sceneId ?? undefined,
      sceneNumber,
      take,
      roll,
      camera,
      intExt,
      dayPart,
    },
  });

  revalidatePath(`/app/${projectId}/claqueta`);
  return { success: true };
}

export async function deleteClapLog(projectId: string, clapLogId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.clapLog.deleteMany({ where: { id: clapLogId, projectId } });
  revalidatePath(`/app/${projectId}/claqueta`);
}
