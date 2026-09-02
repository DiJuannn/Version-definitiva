"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { runContinuityCheckCore, updateContinuityIssueStatusCore } from "@/lib/continuity-core";
import { ContinuityIssueStatus } from "@/lib/generated/prisma";

export type RunContinuityState = { error: string } | undefined;

export async function runContinuityCheck(
  projectId: string,
  // Firma exigida por useActionState (prevState, formData), sin usarlos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: RunContinuityState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<RunContinuityState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const result = await runContinuityCheckCore(projectId, project.organizationId);
  if ("error" in result) return result;

  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion/continuidad/${result.checkId}`);
}

export async function updateContinuityIssueStatus(
  projectId: string,
  checkId: string,
  issueId: string,
  status: ContinuityIssueStatus,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateContinuityIssueStatusCore(projectId, checkId, issueId, status);

  revalidatePath(`/app/${projectId}/guion/continuidad/${checkId}`);
  revalidatePath(`/app/${projectId}/guion`);
}
