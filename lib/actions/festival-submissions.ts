"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { logActivity } from "@/lib/activity-log";
import { optionalDate, optionalDecimal, optionalString } from "@/lib/form-utils";
import {
  createFestivalSubmissionCore,
  deleteFestivalSubmissionCore,
  updateFestivalSubmissionCore,
} from "@/lib/festival-submissions-core";

function revalidate(projectId: string) {
  revalidatePath(`/app/${projectId}/festivales`);
}

export async function createFestivalSubmission(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const festivalName = String(formData.get("festivalName") ?? "");
  const created = await createFestivalSubmissionCore(projectId, {
    festivalName,
    deadline: optionalDate(formData.get("deadline")),
    submittedAt: optionalDate(formData.get("submittedAt")),
    fee: optionalDecimal(formData.get("fee")),
    status: optionalString(formData.get("status")),
    url: optionalString(formData.get("url")),
    notes: optionalString(formData.get("notes")),
  });
  if (!created) return;

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `apuntó un envío a «${festivalName}»`);
  revalidate(projectId);
}

export async function updateFestivalSubmissionStatus(projectId: string, submissionId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateFestivalSubmissionCore(projectId, submissionId, {
    status: optionalString(formData.get("status")),
    submittedAt: optionalDate(formData.get("submittedAt")),
    notes: optionalString(formData.get("notes")),
  });
  revalidate(projectId);
}

export async function deleteFestivalSubmission(projectId: string, submissionId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteFestivalSubmissionCore(projectId, submissionId);
  revalidate(projectId);
}
