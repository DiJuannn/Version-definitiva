"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalDate, optionalDecimal, optionalString } from "@/lib/form-utils";
import { ProjectStatus } from "@/lib/generated/prisma";

const VALID_STATUSES = new Set(Object.values(ProjectStatus));

export async function updateProjectDetails(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const statusInput = String(formData.get("status") ?? "");
  const status = VALID_STATUSES.has(statusInput as ProjectStatus)
    ? (statusInput as ProjectStatus)
    : project.status;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      type: optionalString(formData.get("type")),
      director: optionalString(formData.get("director")),
      producer: optionalString(formData.get("producer")),
      durationLabel: optionalString(formData.get("durationLabel")),
      status,
      startDate: optionalDate(formData.get("startDate")),
      endDate: optionalDate(formData.get("endDate")),
      budgetTarget: optionalDecimal(formData.get("budgetTarget")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath(`/app/${projectId}`);
}
