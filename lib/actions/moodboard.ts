"use server";

import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { uploadProjectFile } from "@/lib/storage";
import { getMoodboard, applyMoodboardOpsCore, getMoodboardVersion, type SaveResult } from "@/lib/moodboard-core";
import { requestMoodboardSuggestions, type SuggestState } from "@/lib/moodboard-ai-request";
import type { MoodboardCard } from "@/lib/moodboard-types";

// Guarda los CAMBIOS de la persona en el tablero (se juntan con los de los demás en el servidor).
export async function saveMoodboard(projectId: string, ops: unknown): Promise<SaveResult> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const pro = await isProjectOwnerPro(project.organizationId);
  return applyMoodboardOpsCore(projectId, ops, pro);
}

// El tablero tal como está ahora en el servidor (para ver lo que han hecho los demás).
export async function fetchMoodboard(
  projectId: string,
): Promise<{ ok: true; cards: MoodboardCard[]; updatedAt: string | null } | { ok: false }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false };
  const board = await getMoodboard(projectId);
  return { ok: true, cards: board.cards, updatedAt: board.updatedAt };
}

export async function moodboardVersion(projectId: string): Promise<string | null> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return null;
  return getMoodboardVersion(projectId);
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Sube una imagen al almacenamiento del proyecto y devuelve su enlace público.
export async function uploadMoodboardImage(
  projectId: string,
  formData: FormData,
): Promise<{ url: string } | { error: string }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No se recibió ninguna imagen." };
  if (!file.type.startsWith("image/")) return { error: "Solo se pueden subir imágenes." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "La imagen pesa más de 8 MB." };

  const uploaded = await uploadProjectFile(`moodboard/${projectId}`, file);
  if (!uploaded) return { error: "No se pudo subir la imagen. Inténtalo de nuevo." };
  return { url: uploaded.url };
}

export type { SuggestState };

// Pide a la IA referencias para el moodboard a partir del resumen del proyecto.
// Gratis: 1 por proyecto; PRO: hasta 10 al día por proyecto.
export async function suggestReferences(projectId: string): Promise<SuggestState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  return requestMoodboardSuggestions(projectId, project.organizationId);
}
