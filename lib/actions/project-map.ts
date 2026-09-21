"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { logActivity } from "@/lib/activity-log";
import { updateTaskStatusCore } from "@/lib/tasks-core";
import {
  createMapBoardCore,
  deleteMapBoardCore,
  renameMapBoardCore,
  saveMapLayoutCore,
  setMapBoardSharingCore,
  type BoardResult,
  type MapSaveResult,
} from "@/lib/project-map";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { uploadProjectFile } from "@/lib/storage";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { ProjectStatus } from "@/lib/generated/prisma";

// Guarda la disposición del mapa (posiciones, tarjetas ocultas y notas).
export async function saveProjectMap(
  projectId: string,
  boardId: string,
  layout: unknown,
  baseUpdatedAt: string | null,
): Promise<MapSaveResult> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const pro = await isProjectOwnerPro(project.organizationId);
  return saveMapLayoutCore(projectId, boardId, layout, baseUpdatedAt, pro);
}

// ---- Varias pizarras y enlace público

export async function createMapBoard(projectId: string, name: string): Promise<BoardResult> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const pro = await isProjectOwnerPro(project.organizationId);
  const result = await createMapBoardCore(projectId, name, pro);
  if (result.ok) revalidatePath(`/app/${projectId}/resumen`);
  return result;
}

export async function renameMapBoard(projectId: string, boardId: string, name: string): Promise<{ ok: boolean }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false };
  const ok = await renameMapBoardCore(projectId, boardId, name);
  if (ok) revalidatePath(`/app/${projectId}/resumen`);
  return { ok };
}

export async function deleteMapBoard(projectId: string, boardId: string): Promise<{ ok: boolean; error?: string }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const result = await deleteMapBoardCore(projectId, boardId);
  if (result.ok) revalidatePath(`/app/${projectId}/resumen`);
  return result;
}

export async function setMapBoardSharing(
  projectId: string,
  boardId: string,
  enabled: boolean,
): Promise<{ ok: true; token: string | null } | { ok: false; error: string; upgrade?: boolean }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const pro = await isProjectOwnerPro(project.organizationId);
  const result = await setMapBoardSharingCore(projectId, boardId, enabled, pro);
  if (result.ok) revalidatePath(`/app/${projectId}/resumen`);
  return result;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Sube una imagen de la pizarra al almacenamiento del proyecto y devuelve su enlace público.
export async function uploadMapImage(
  projectId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No se recibió ninguna imagen." };
  if (!file.type.startsWith("image/")) return { error: "Solo se pueden subir imágenes." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "La imagen pesa más de 8 MB." };

  const uploaded = await uploadProjectFile(`map/${projectId}`, file);
  if (!uploaded) return { error: "No se pudo subir la imagen. Inténtalo de nuevo." };
  return { url: uploaded.url };
}

// Acción rápida: completar una tarea desde su tarjeta del mapa.
export async function completeMapTask(projectId: string, taskId: string): Promise<{ ok: boolean }> {
  const project = await getProjectForCurrentUser(projectId);
  const profile = await getCurrentProfile();
  if (!project || !profile) return { ok: false };

  const task = await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { organizationId: true } });
  if (!task) return { ok: false };

  const updated = await updateTaskStatusCore(task.organizationId, taskId, profile.id, "DONE");
  if (!updated) return { ok: false };

  revalidatePath(`/app/${projectId}/tareas`);
  revalidatePath("/app/tareas");
  return { ok: true };
}

// Acción rápida: cambiar el estado del proyecto desde su tarjeta del mapa.
export async function setMapProjectStatus(projectId: string, status: string): Promise<{ ok: boolean }> {
  const project = await getProjectForCurrentUser(projectId);
  const profile = await getCurrentProfile();
  if (!project || !profile) return { ok: false };
  if (!(Object.values(ProjectStatus) as string[]).includes(status)) return { ok: false };

  await prisma.project.update({ where: { id: projectId }, data: { status: status as ProjectStatus } });
  await logActivity(projectId, profile.id, `cambió el estado del proyecto a «${PROJECT_STATUS_LABELS[status as ProjectStatus]}»`);

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app/proyectos");
  revalidatePath("/app");
  return { ok: true };
}
