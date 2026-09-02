"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { analyzeScriptCore, importScriptAnalysisCore } from "@/lib/script-analysis-core";
import { BreakdownCategory } from "@/lib/generated/prisma";

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

  const result = await analyzeScriptCore(
    projectId,
    scriptFileId,
    profile.id,
    profile.organization.plan,
  );
  if ("error" in result) return result;

  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion/analisis/${result.analysisId}`);
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

  const proposal = analysis.proposedData as unknown as {
    characters: unknown[];
    locations: unknown[];
    props: { category?: string | null }[];
    scenes: unknown[];
  };

  const validCategories = new Set<string>(Object.values(BreakdownCategory));

  const characterIndices = proposal.characters
    .map((_, i) => i)
    .filter((i) => formData.get(`character_${i}`));
  const locationIndices = proposal.locations
    .map((_, i) => i)
    .filter((i) => formData.get(`location_${i}`));
  const sceneIndices = proposal.scenes
    .map((_, i) => i)
    .filter((i) => formData.get(`scene_${i}`));
  const props = proposal.props
    .map((prop, i) => {
      if (!formData.get(`prop_${i}`)) return null;
      const submittedCategory = String(formData.get(`category_${i}`) ?? "");
      const category = validCategories.has(submittedCategory)
        ? submittedCategory
        : (prop.category ?? BreakdownCategory.PROP);
      return { index: i, category };
    })
    .filter((p): p is { index: number; category: string } => p !== null);

  await importScriptAnalysisCore(projectId, project.organizationId, analysisId, {
    characterIndices,
    locationIndices,
    props,
    sceneIndices,
  });

  revalidatePath(`/app/${projectId}/guion`);
  revalidatePath(`/app/${projectId}/desglose`);
  revalidatePath(`/app/${projectId}/personajes`);
  revalidatePath("/app/localizaciones");
  redirect(`/app/${projectId}/guion`);
}
