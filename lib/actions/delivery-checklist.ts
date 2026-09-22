"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { createTaskCore } from "@/lib/tasks-core";
import { DELIVERY_CATEGORY, DELIVERY_CHECKLIST_DEFAULTS } from "@/lib/delivery-checklist";

export type DeliveryChecklistState = { error: string } | undefined;

// Crea la checklist de entrega de siempre (solo si el proyecto todavía no tiene ninguna): son
// Tareas normales con category "Entrega", para no montar un segundo sistema de pendientes.
// Firma (prevState, formData) exigida por useActionState — los usa ActionButtonForm en la web.
export async function createDeliveryChecklist(
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState?: DeliveryChecklistState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData?: FormData,
): Promise<DeliveryChecklistState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const existing = await prisma.task.count({ where: { projectId, category: DELIVERY_CATEGORY } });
  if (existing > 0) return { error: "Ya tienes una checklist de entrega en este proyecto." };

  const profile = await getCurrentProfile();
  if (!profile) return { error: "No tienes acceso a este proyecto." };
  for (const title of DELIVERY_CHECKLIST_DEFAULTS) {
    await createTaskCore(project.organizationId, projectId, profile.id, { title, category: DELIVERY_CATEGORY });
  }

  revalidatePath(`/app/${projectId}/montaje`);
  revalidatePath(`/app/${projectId}/tareas`);
  return undefined;
}
