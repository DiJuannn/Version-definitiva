import * as Sentry from "@sentry/nextjs";
import { claimMoodboardAiUse, getMoodboard, refundMoodboardAiUse } from "@/lib/moodboard-core";
import { buildMoodboardBrief, suggestMoodboardReferences, type MoodboardProposal } from "@/lib/moodboard-ai";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { MOODBOARD_AI_FREE_PER_PROJECT, MOODBOARD_AI_PRO_DAILY_LIMIT } from "@/lib/limits";

export type SuggestState =
  | { ok: true; proposal: MoodboardProposal; boardUpdatedAt: string | null }
  | { ok: false; error: string; upgrade?: boolean };

// Pide a la IA referencias para el moodboard a partir del resumen del proyecto. Gratis: 1 por proyecto; PRO: hasta
// 10 al día por proyecto. Compartido por la Server Action de la web y la ruta de la app; la comprobación de acceso
// al proyecto la hace quien llama.
export async function requestMoodboardSuggestions(projectId: string, organizationId: string): Promise<SuggestState> {
  const pro = await isProjectOwnerPro(organizationId);

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
