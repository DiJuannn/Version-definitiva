import { prisma } from "@/lib/prisma";

export async function createBudgetCategoryCore(projectId: string, name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const count = await prisma.budgetCategory.count({ where: { projectId } });
  const category = await prisma.budgetCategory.create({
    data: { projectId, name: trimmed, order: count },
  });
  return category.id;
}

export async function deleteBudgetCategoryCore(projectId: string, categoryId: string) {
  await prisma.budgetCategory.deleteMany({ where: { id: categoryId, projectId } });
}

export type CreateBudgetItemInput = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  taxRate: number | null;
  notes: string | null;
  actorId?: string | null;
  locationId?: string | null;
  crewMemberId?: string | null;
  breakdownElementId?: string | null;
};

export async function createBudgetItemCore(
  projectId: string,
  organizationId: string,
  categoryId: string,
  input: CreateBudgetItemInput,
): Promise<string | null> {
  const category = await prisma.budgetCategory.findFirst({ where: { id: categoryId, projectId } });
  if (!category) return null;

  const description = input.description.trim();
  if (!description) return null;

  const [actor, location, crewMember, breakdownElement] = await Promise.all([
    input.actorId ? prisma.actor.findFirst({ where: { id: input.actorId, projectId } }) : null,
    input.locationId
      ? prisma.location.findFirst({ where: { id: input.locationId, organizationId } })
      : null,
    input.crewMemberId
      ? prisma.crewMember.findFirst({ where: { id: input.crewMemberId, projectId } })
      : null,
    input.breakdownElementId
      ? prisma.breakdownElement.findFirst({ where: { id: input.breakdownElementId, projectId } })
      : null,
  ]);

  const item = await prisma.budgetItem.create({
    data: {
      categoryId,
      description,
      quantity: input.quantity ?? 1,
      unitPrice: input.unitPrice ?? 0,
      taxRate: input.taxRate ?? 0,
      notes: input.notes,
      actorId: actor?.id,
      locationId: location?.id,
      crewMemberId: crewMember?.id,
      breakdownElementId: breakdownElement?.id,
    },
  });
  return item.id;
}

export async function deleteBudgetItemCore(projectId: string, itemId: string) {
  await prisma.budgetItem.deleteMany({ where: { id: itemId, category: { projectId } } });
}
