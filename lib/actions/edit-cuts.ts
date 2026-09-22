"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { logActivity } from "@/lib/activity-log";
import { optionalDate, optionalString } from "@/lib/form-utils";
import { createEditCutCore, deleteEditCutCore, updateEditCutCore } from "@/lib/edit-cuts-core";

function revalidate(projectId: string) {
  revalidatePath(`/app/${projectId}/montaje`);
}

export async function createEditCut(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const created = await createEditCutCore(projectId, {
    name: String(formData.get("name") ?? ""),
    durationLabel: optionalString(formData.get("durationLabel")),
    date: optionalDate(formData.get("date")),
    status: optionalString(formData.get("status")),
    notes: optionalString(formData.get("notes")),
  });
  if (!created) return;

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `añadió un corte de montaje (${String(formData.get("name") ?? "")})`);
  revalidate(projectId);
}

export async function updateEditCut(projectId: string, cutId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateEditCutCore(projectId, cutId, {
    status: optionalString(formData.get("status")),
    notes: optionalString(formData.get("notes")),
    durationLabel: optionalString(formData.get("durationLabel")),
    date: optionalDate(formData.get("date")),
  });
  revalidate(projectId);
}

export async function deleteEditCut(projectId: string, cutId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteEditCutCore(projectId, cutId);
  revalidate(projectId);
}
