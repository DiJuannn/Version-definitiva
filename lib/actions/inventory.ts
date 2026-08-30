"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { InventoryItemCategory } from "@/lib/generated/prisma";

function readCategory(formData: FormData): InventoryItemCategory {
  const raw = String(formData.get("category") ?? "OTHER");
  const valid = new Set(Object.values(InventoryItemCategory) as string[]);
  return valid.has(raw) ? (raw as InventoryItemCategory) : "OTHER";
}

function readQuantity(formData: FormData): number {
  const num = Number(formData.get("quantity"));
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 1;
}

export async function createInventoryItem(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.inventoryItem.create({
    data: {
      organizationId: profile.organizationId,
      name,
      category: readCategory(formData),
      quantity: readQuantity(formData),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/app/inventario");
}

export async function updateInventoryItem(itemId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.inventoryItem.updateMany({
    where: { id: itemId, organizationId: profile.organizationId },
    data: {
      name,
      category: readCategory(formData),
      quantity: readQuantity(formData),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/app/inventario");
}

export async function deleteInventoryItem(itemId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.inventoryItem.deleteMany({
    where: { id: itemId, organizationId: profile.organizationId },
  });

  revalidatePath("/app/inventario");
}

export async function updateDayItemReservations(
  projectId: string,
  dayId: string,
  formData: FormData,
) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const day = await prisma.shootingDay.findFirst({
    where: { id: dayId, projectId, project: { organizationId: profile.organizationId } },
  });
  if (!day) return;

  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: profile.organizationId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.itemReservation.deleteMany({ where: { shootingDayId: dayId } });

    const toCreate = items
      .filter((item) => formData.get(`reserve_${item.id}`) === "on")
      .map((item) => {
        const qty = Number(formData.get(`qty_${item.id}`));
        return {
          shootingDayId: dayId,
          inventoryItemId: item.id,
          quantity: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1,
        };
      });

    if (toCreate.length > 0) {
      await tx.itemReservation.createMany({ data: toCreate });
    }
  });

  revalidatePath(`/app/${projectId}/plan-de-rodaje/${dayId}`);
}
