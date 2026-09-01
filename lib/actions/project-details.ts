"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { updateProjectDetailsCore } from "@/lib/project-details-core";

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
