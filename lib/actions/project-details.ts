"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { updateProjectDetailsCore } from "@/lib/project-details-core";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { logActivity } from "@/lib/activity-log";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { ProjectStatus } from "@/lib/generated/prisma";

// Cambia solo el estado (los botones «Empezar el rodaje», «Rodaje terminado»…). Vale cualquier
// estado real; lo demás del proyecto no se toca.
export async function setProjectStatus(projectId: string, status: string): Promise<void> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;
  if (!(Object.values(ProjectStatus) as string[]).includes(status)) return;
  if (project.status === status) return;

  await prisma.project.update({ where: { id: projectId }, data: { status: status as ProjectStatus } });
  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `cambió el estado a «${PROJECT_STATUS_LABELS[status as ProjectStatus]}»`);

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app/proyectos");
}

export async function updateProjectDetails(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await updateProjectDetailsCore(projectId, project.status, {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    status: String(formData.get("status") ?? ""),
    director: String(formData.get("director") ?? ""),
    producer: String(formData.get("producer") ?? ""),
    durationLabel: String(formData.get("durationLabel") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    budgetTarget: (() => {
      const str = String(formData.get("budgetTarget") ?? "").trim();
      if (!str) return null;
      const num = Number(str);
      return Number.isFinite(num) ? num : null;
    })(),
    notes: String(formData.get("notes") ?? ""),
  });

  revalidatePath(`/app/${projectId}`);
}
