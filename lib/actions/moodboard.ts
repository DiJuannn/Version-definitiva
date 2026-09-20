"use server";

import * as Sentry from "@sentry/nextjs";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { uploadProjectFile } from "@/lib/storage";
import {
  claimMoodboardAiUse,
  getMoodboard,
  refundMoodboardAiUse,
  saveMoodboardCore,
  type SaveResult,
} from "@/lib/moodboard-core";
import { buildMoodboardBrief, suggestMoodboardReferences, type MoodboardProposal } from "@/lib/moodboard-ai";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { MOODBOARD_AI_FREE_PER_PROJECT, MOODBOARD_AI_PRO_DAILY_LIMIT } from "@/lib/limits";

// Guarda las tarjetas del tablero (con control de conflictos, ver saveMoodboardCore).
export async function saveMoodboard(
  projectId: string,
  cards: unknown,
  baseUpdatedAt: string | null,
): Promise<SaveResult> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };
  const pro = await isProjectOwnerPro(project.organizationId);
  return saveMoodboardCore(projectId, cards, baseUpdatedAt, pro);
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

export type SuggestState =
  | { ok: true; proposal: MoodboardProposal; boardUpdatedAt: string | null }
  | { ok: false; error: string; upgrade?: boolean };

// Pide a la IA referencias para el moodboard a partir del resumen del proyecto.
// Gratis: 1 por proyecto; PRO: hasta 10 al día por proyecto.
export async function suggestReferences(projectId: string): Promise<SuggestState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { ok: false, error: "No tienes acceso a este proyecto." };

  const pro = await isProjectOwnerPro(project.organizationId);

  const built = await buildMoodboardBrief(projectId);
  if (!built) return { ok: false, error: "No se encontró el proyecto." };
  if (!built.hasSubstance) {
    return {
      ok: false,
      error:
        "Todavía hay poco de lo que tirar. Sube el guion o escribe una sinopsis en «Datos del proyecto» y vuelve a probar.",
    };
  }

  const claim = await claimMoodboardAiUse(projectId, pro);
  if (!claim.ok) {
    return claim.reason === "free"
      ? {
          ok: false,
          upgrade: true,
          error: `Ya has usado la sugerencia gratuita de este proyecto (${MOODBOARD_AI_FREE_PER_PROJECT} por proyecto). Con PRO tienes hasta ${MOODBOARD_AI_PRO_DAILY_LIMIT} al día.`,
        }
      : {
          ok: false,
          error: `Has llegado al tope de ${MOODBOARD_AI_PRO_DAILY_LIMIT} sugerencias de hoy en este proyecto. Mañana podrás pedir más.`,
        };
  }

  try {
    const proposal = await withMistralSlot(() => suggestMoodboardReferences(built.brief));
    if (proposal.references.length === 0 && proposal.ideas.length === 0) {
      await refundMoodboardAiUse(projectId);
      return { ok: false, error: "La IA no devolvió sugerencias esta vez. Inténtalo de nuevo." };
    }
    const board = await getMoodboard(projectId, pro);
    return { ok: true, proposal, boardUpdatedAt: board.updatedAt };
  } catch (error) {
    await refundMoodboardAiUse(projectId).catch(() => undefined);
    if (error instanceof MistralBusyError) {
      return { ok: false, error: "La IA está muy ocupada ahora mismo. Prueba de nuevo en un minuto." };
    }
    Sentry.captureException(error);
    return { ok: false, error: "No se pudieron generar las referencias. Inténtalo de nuevo." };
  }
}
