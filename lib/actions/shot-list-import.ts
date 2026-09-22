"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { analyzeShotListCore, importShotListCore } from "@/lib/shot-list-import-core";

export type AnalyzeShotListState = { error: string } | undefined;

export async function analyzeShotList(
  projectId: string,
  _prevState: AnalyzeShotListState,
  formData: FormData,
): Promise<AnalyzeShotListState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "No tienes acceso a este proyecto." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo antes de subir." };
  }

  const result = await analyzeShotListCore(projectId, profile.organization.plan, profile.id, file);
  if ("error" in result) return result;

  redirect(`/app/${projectId}/shot-list/importar/${result.importId}`);
}

export type ImportShotListState = { error: string } | undefined;

export async function importReviewedShotList(
  projectId: string,
  importId: string,
  reviewed: unknown,
): Promise<ImportShotListState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const ok = await importShotListCore(projectId, importId, reviewed);
  if (!ok) return { error: "No se encontró la importación. Recarga la página." };

  revalidatePath(`/app/${projectId}/shot-list`);
  revalidatePath(`/app/${projectId}/guion`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
  redirect(`/app/${projectId}/shot-list`);
}

export async function discardShotListImport(projectId: string, importId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.shotListImport.deleteMany({ where: { id: importId, projectId } });
  redirect(`/app/${projectId}/shot-list`);
}
