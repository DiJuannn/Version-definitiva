"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { analyzeScriptPdf, type ScriptAnalysisProposal } from "@/lib/mistral";
import { BreakdownCategory, DayPart, IntExt } from "@/lib/generated/prisma";
import {
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_HOURLY_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
} from "@/lib/limits";
import { checkScriptAnalysisRateLimit, formatWait } from "@/lib/script-analysis-rate-limit";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { isPro as isProPlan } from "@/lib/plan";
import * as Sentry from "@sentry/nextjs";

function cleanText(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type AnalyzeScriptState = { error: string } | undefined;

export async function analyzeScript(
  projectId: string,
  scriptFileId: string,
  // Firma exigida por useActionState (prevState, formData), sin usarlos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: AnalyzeScriptState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<AnalyzeScriptState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "No tienes acceso a este proyecto." };

  const scriptFile = await prisma.scriptFile.findFirst({
    where: { id: scriptFileId, projectId },
  });
  if (!scriptFile) return { error: "No se encontró el guion. Recarga la página." };

  const isPro = isProPlan(profile.organization.plan);

  // Tope de por vida solo para el plan gratuito — es una prueba del
  // producto, no una herramienta de uso habitual. Sin tiempo de espera:
  // hay que pasarse a PRO.
  if (!isPro) {
    const lifetimeCount = await prisma.scriptAnalysis.count({
      where: { createdById: profile.id },
    });
    if (lifetimeCount >= SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT) {
      return {
        error: `Has usado los ${SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT} análisis disponibles en tu cuenta gratuita. Pásate a PRO en Organización para seguir analizando.`,
      };
    }
  }

  // Tope por hora — igual para gratis y PRO, protege la cuota compartida
  // de tokens/minuto de Mistral de que una sola cuenta la agote lanzando
  // análisis seguidos (ver lib/limits.ts). No se anuncia en ningún
  // sitio salvo cuando se llega a él.
  const hourlyStatus = await checkScriptAnalysisRateLimit(
    profile.id,
    SCRIPT_ANALYSIS_HOURLY_LIMIT,
    60 * 60 * 1000,
  );
  if (hourlyStatus.blocked && hourlyStatus.retryAt) {
    return {
      error: `Has lanzado ${SCRIPT_ANALYSIS_HOURLY_LIMIT} análisis seguidos. Puedes volver a intentarlo en ${formatWait(hourlyStatus.retryAt)}.`,
    };
  }

  // Tope diario — 1 al día en gratis, 50 al día en PRO.
  const dailyLimit = isPro ? SCRIPT_ANALYSIS_PRO_DAILY_LIMIT : SCRIPT_ANALYSIS_FREE_DAILY_LIMIT;
  const dailyStatus = await checkScriptAnalysisRateLimit(profile.id, dailyLimit, 24 * 60 * 60 * 1000);
  if (dailyStatus.blocked && dailyStatus.retryAt) {
    return {
      error: isPro
        ? `Has alcanzado el máximo de ${dailyLimit} análisis en 24 horas. Puedes volver a intentarlo en ${formatWait(dailyStatus.retryAt)}.`
        : `Ya has usado tu análisis de hoy en el plan gratuito. Puedes volver a intentarlo en ${formatWait(dailyStatus.retryAt)}, o pásate a PRO en Organización para analizar más.`,
    };
  }

  let proposal;
  try {
    proposal = await withMistralSlot(() => analyzeScriptPdf(scriptFile.fileUrl));
  } catch (error) {
    if (error instanceof MistralBusyError) {
      return {
        error: "Hay varios análisis en marcha ahora mismo. Inténtalo de nuevo en unos segundos.",
      };
    }
    console.error("analyzeScript: fallo llamando a Mistral", error);
    Sentry.captureException(error, {
      tags: { area: "mistral", action: "analyzeScript" },
      extra: { projectId, scriptFileId },
    });
    return {
      error:
        "La IA no está disponible en este momento. Tus datos están seguros — inténtalo de nuevo en un rato.",
    };
  }

  const analysis = await prisma.scriptAnalysis.create({
    data: {
      projectId,
      scriptFileId,
      createdById: profile.id,
      proposedData: proposal,
    },
  });

  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion/analisis/${analysis.id}`);
}

export async function importScriptAnalysis(
  projectId: string,
  analysisId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const analysis = await prisma.scriptAnalysis.findFirst({
    where: { id: analysisId, projectId },
  });
  if (!analysis) return;

  const proposal = analysis.proposedData as unknown as ScriptAnalysisProposal;

  const [existingCharacters, existingLocations, existingProps] = await Promise.all([
    prisma.character.findMany({ where: { projectId } }),
    prisma.location.findMany({ where: { organizationId: project.organizationId } }),
    prisma.breakdownElement.findMany({ where: { projectId } }),
  ]);

  const characterIdByName = new Map(
    existingCharacters.map((c) => [c.name.toLowerCase(), c.id]),
  );
  const locationIdByName = new Map(
    existingLocations.map((l) => [l.name.toLowerCase(), l.id]),
  );
  const propIdByName = new Map(existingProps.map((p) => [p.name.toLowerCase(), p.id]));

  for (let i = 0; i < proposal.characters.length; i++) {
    if (!formData.get(`character_${i}`)) continue;
    const character = proposal.characters[i];
    const key = character.name.toLowerCase();
    if (characterIdByName.has(key)) continue;
    const created = await prisma.character.create({
      data: { projectId, name: character.name, notes: cleanText(character.notes) },
    });
    characterIdByName.set(key, created.id);
  }

  for (let i = 0; i < proposal.locations.length; i++) {
    if (!formData.get(`location_${i}`)) continue;
    const location = proposal.locations[i];
    const key = location.name.toLowerCase();
    if (locationIdByName.has(key)) continue;
    const created = await prisma.location.create({
      data: {
        organizationId: project.organizationId,
        name: location.name,
        notes: cleanText(location.notes),
      },
    });
    locationIdByName.set(key, created.id);
  }

  const validCategories = new Set<string>(Object.values(BreakdownCategory));

  for (let i = 0; i < proposal.props.length; i++) {
    if (!formData.get(`prop_${i}`)) continue;
    const prop = proposal.props[i];
    const key = prop.name.toLowerCase();
    if (propIdByName.has(key)) continue;

    // La categoría puede venir editada desde el desplegable de la página de
    // revisión (category_i) — si no, se cae a la que propuso la IA, y si
    // esa tampoco es válida, a PROP por defecto.
    const submittedCategory = String(formData.get(`category_${i}`) ?? "");
    const category = validCategories.has(submittedCategory)
      ? (submittedCategory as BreakdownCategory)
      : validCategories.has(prop.category ?? "")
        ? (prop.category as BreakdownCategory)
        : BreakdownCategory.PROP;

    const created = await prisma.breakdownElement.create({
      data: { projectId, category, name: prop.name },
    });
    propIdByName.set(key, created.id);
  }

  const existingSceneCount = await prisma.scene.count({ where: { projectId } });
  let order = existingSceneCount;

  for (let i = 0; i < proposal.scenes.length; i++) {
    if (!formData.get(`scene_${i}`)) continue;
    const scene = proposal.scenes[i];
    if (!scene.number) continue;

    const locationId = scene.locationName
      ? locationIdByName.get(scene.locationName.toLowerCase())
      : undefined;

    const characterIds = (scene.characterNames ?? [])
      .map((name) => characterIdByName.get(name.toLowerCase()))
      .filter((id): id is string => Boolean(id));

    const propIds = (scene.propNames ?? [])
      .map((name) => propIdByName.get(name.toLowerCase()))
      .filter((id): id is string => Boolean(id));

    const intExt = (Object.values(IntExt) as string[]).includes(scene.intExt ?? "")
      ? (scene.intExt as IntExt)
      : undefined;
    const dayPart = (Object.values(DayPart) as string[]).includes(scene.dayPart ?? "")
      ? (scene.dayPart as DayPart)
      : undefined;

    const createdScene = await prisma.scene.create({
      data: {
        projectId,
        number: scene.number,
        intExt,
        dayPart,
        locationId,
        description: cleanText(scene.description),
        action: cleanText(scene.action),
        dialogueNotes: cleanText(scene.dialogueNotes),
        order: order++,
      },
    });

    if (characterIds.length > 0) {
      await prisma.sceneCharacter.createMany({
        data: characterIds.map((characterId) => ({
          sceneId: createdScene.id,
          characterId,
        })),
      });
    }
    if (propIds.length > 0) {
      await prisma.sceneBreakdownElement.createMany({
        data: propIds.map((breakdownElementId) => ({
          sceneId: createdScene.id,
          breakdownElementId,
        })),
      });
    }
  }

  await prisma.scriptAnalysis.update({
    where: { id: analysisId },
    data: { status: "REVIEWED", reviewedAt: new Date() },
  });

  revalidatePath(`/app/${projectId}/guion`);
  revalidatePath(`/app/${projectId}/desglose`);
  revalidatePath(`/app/${projectId}/personajes`);
  revalidatePath("/app/localizaciones");
  redirect(`/app/${projectId}/guion`);
}
