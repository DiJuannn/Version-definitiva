"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { analyzeScriptPdf, type ScriptAnalysisProposal } from "@/lib/mistral";
import { DayPart, IntExt } from "@/lib/generated/prisma";

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

  const scriptFile = await prisma.scriptFile.findFirst({
    where: { id: scriptFileId, projectId },
  });
  if (!scriptFile) return { error: "No se encontró el guion. Recarga la página." };

  let proposal;
  try {
    proposal = await analyzeScriptPdf(scriptFile.fileUrl);
  } catch (error) {
    console.error("analyzeScript: fallo llamando a Mistral", error);
    return {
      error:
        "La IA no está disponible en este momento. Tus datos están seguros — inténtalo de nuevo en un rato.",
    };
  }

  const analysis = await prisma.scriptAnalysis.create({
    data: {
      projectId,
      scriptFileId,
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
    prisma.breakdownElement.findMany({ where: { projectId, category: "PROP" } }),
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

  for (let i = 0; i < proposal.props.length; i++) {
    if (!formData.get(`prop_${i}`)) continue;
    const prop = proposal.props[i];
    const key = prop.name.toLowerCase();
    if (propIdByName.has(key)) continue;
    const created = await prisma.breakdownElement.create({
      data: { projectId, category: "PROP", name: prop.name },
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
