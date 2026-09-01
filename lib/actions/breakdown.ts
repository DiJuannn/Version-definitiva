"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import {
  createBreakdownElementCore,
  createCrewMemberCore,
  deleteBreakdownElementCore,
  deleteCrewMemberCore,
  updateBreakdownElementCategoryCore,
} from "@/lib/breakdown-core";

export async function createBreakdownElement(
  projectId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await createBreakdownElementCore(projectId, {
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function deleteBreakdownElement(
  projectId: string,
  elementId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteBreakdownElementCore(projectId, elementId);

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function updateBreakdownElementCategory(
  projectId: string,
  elementId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateBreakdownElementCategoryCore(
    projectId,
    elementId,
    String(formData.get("category") ?? ""),
  );

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function createCrewMember(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await createCrewMemberCore(projectId, project.organizationId, {
    personId: optionalString(formData.get("personId")),
    name: String(formData.get("name") ?? ""),
    role: optionalString(formData.get("role")),
    email: optionalString(formData.get("email")),
    phone: optionalString(formData.get("phone")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function deleteCrewMember(projectId: string, crewMemberId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteCrewMemberCore(projectId, crewMemberId);

  revalidatePath(`/app/${projectId}/desglose`);
}
