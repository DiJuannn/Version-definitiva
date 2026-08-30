"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";

export async function createChecklistTemplate(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.checklistTemplate.create({
    data: { organizationId: profile.organizationId, name },
  });

  revalidatePath("/app/tareas");
}

export async function addChecklistTemplateItem(
  templateId: string,
  formData: FormData,
) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: templateId, organizationId: profile.organizationId },
  });
  if (!template) return;

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  const count = await prisma.checklistTemplateItem.count({ where: { templateId } });
  await prisma.checklistTemplateItem.create({
    data: { templateId, label, order: count },
  });

  revalidatePath("/app/tareas");
}

export async function deleteChecklistTemplate(templateId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.checklistTemplate.deleteMany({
    where: { id: templateId, organizationId: profile.organizationId },
  });

  revalidatePath("/app/tareas");
}

export async function applyChecklistTemplate(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const templateId = String(formData.get("templateId") ?? "");
  const requestedProjectId = String(formData.get("projectId") ?? "").trim() || null;

  const [template, project] = await Promise.all([
    prisma.checklistTemplate.findFirst({
      where: { id: templateId, organizationId: profile.organizationId },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    requestedProjectId
      ? prisma.project.findFirst({
          where: { id: requestedProjectId, organizationId: profile.organizationId },
        })
      : null,
  ]);
  if (!template || template.items.length === 0) return;

  await prisma.task.createMany({
    data: template.items.map((item) => ({
      organizationId: profile.organizationId,
      projectId: project?.id,
      title: item.label,
      category: template.name,
    })),
  });

  revalidatePath("/app");
  revalidatePath("/app/tareas");
  if (project) revalidatePath(`/app/${project.id}/tareas`);
}
