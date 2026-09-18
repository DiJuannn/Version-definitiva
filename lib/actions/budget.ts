"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalDecimal, optionalString } from "@/lib/form-utils";
import {
  createBudgetCategoryCore,
  createBudgetItemCore,
  deleteBudgetCategoryCore,
  deleteBudgetItemCore,
  setBudgetItemActualCore,
} from "@/lib/budget-core";

export async function createBudgetCategory(
  projectId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await createBudgetCategoryCore(projectId, String(formData.get("name") ?? ""));

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export async function deleteBudgetCategory(
  projectId: string,
  categoryId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteBudgetCategoryCore(projectId, categoryId);

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export async function createBudgetItem(
  projectId: string,
  categoryId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await createBudgetItemCore(projectId, project.organizationId, categoryId, {
    description: String(formData.get("description") ?? ""),
    quantity: optionalDecimal(formData.get("quantity")),
    unitPrice: optionalDecimal(formData.get("unitPrice")),
    taxRate: optionalDecimal(formData.get("taxRate")),
    notes: optionalString(formData.get("notes")),
    actorId: optionalString(formData.get("actorId")),
    locationId: optionalString(formData.get("locationId")),
    crewMemberId: optionalString(formData.get("crewMemberId")),
    breakdownElementId: optionalString(formData.get("breakdownElementId")),
  });

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export async function deleteBudgetItem(projectId: string, itemId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteBudgetItemCore(projectId, itemId);

  revalidatePath(`/app/${projectId}/presupuesto`);
}

export type BudgetActualState = { error: string } | { ok: true; amount: number | null } | undefined;

// Gasto real de una partida: vacío = sin gastar todavía.
export async function setBudgetItemActual(
  projectId: string,
  itemId: string,
  _prev: BudgetActualState,
  formData: FormData,
): Promise<BudgetActualState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No se encontró el proyecto." };

  const raw = String(formData.get("actualAmount") ?? "").trim().replace(",", ".");
  const amount = raw === "" ? null : Number(raw);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return { error: "Escribe un importe válido (por ejemplo 250 o 250,50)." };
  }

  const ok = await setBudgetItemActualCore(projectId, itemId, amount);
  if (!ok) return { error: "No se pudo guardar el gasto." };

  revalidatePath(`/app/${projectId}/presupuesto`);
  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  return { ok: true, amount };
}
