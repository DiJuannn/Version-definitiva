"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalDecimal, optionalString } from "@/lib/form-utils";

export async function createBudgetCategory(
  projectId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const count = await prisma.budgetCategory.count({ where: { projectId } });
  await prisma.budgetCategory.create({
    data: { projectId, name, order: count },
  });

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export async function deleteBudgetCategory(
  projectId: string,
  categoryId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.budgetCategory.deleteMany({
    where: { id: categoryId, projectId },
  });

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export async function createBudgetItem(
  projectId: string,
  categoryId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const category = await prisma.budgetCategory.findFirst({
    where: { id: categoryId, projectId },
  });
  if (!category) return;

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return;

  const actorId = optionalString(formData.get("actorId"));
  const locationId = optionalString(formData.get("locationId"));
  const crewMemberId = optionalString(formData.get("crewMemberId"));
  const breakdownElementId = optionalString(formData.get("breakdownElementId"));

  const [actor, location, crewMember, breakdownElement] = await Promise.all([
    actorId ? prisma.actor.findFirst({ where: { id: actorId, projectId } }) : null,
    locationId
      ? prisma.location.findFirst({
          where: { id: locationId, organizationId: project.organizationId },
        })
      : null,
    crewMemberId
      ? prisma.crewMember.findFirst({ where: { id: crewMemberId, projectId } })
      : null,
    breakdownElementId
      ? prisma.breakdownElement.findFirst({
          where: { id: breakdownElementId, projectId },
        })
      : null,
  ]);

  await prisma.budgetItem.create({
    data: {
      categoryId,
      description,
      quantity: optionalDecimal(formData.get("quantity")) ?? 1,
      unitPrice: optionalDecimal(formData.get("unitPrice")) ?? 0,
      taxRate: optionalDecimal(formData.get("taxRate")) ?? 0,
      notes: optionalString(formData.get("notes")),
      actorId: actor?.id,
      locationId: location?.id,
      crewMemberId: crewMember?.id,
      breakdownElementId: breakdownElement?.id,
    },
  });

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export async function deleteBudgetItem(projectId: string, itemId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.budgetItem.deleteMany({
    where: { id: itemId, category: { projectId } },
  });

  revalidatePath(`/app/${projectId}/presupuesto`);
}
