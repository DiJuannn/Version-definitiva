"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalDecimal, optionalString } from "@/lib/form-utils";
import {
  createBudgetCategoryCore,
  createBudgetItemCore,
  createStarterBudgetCore,
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

export type StarterBudgetState = { error: string } | undefined;

// Crea las categorías típicas según el tipo de proyecto (solo títulos, sin importes). Solo si el
// presupuesto está vacío, para no duplicar nada.
export async function createStarterBudget(
  projectId: string,
  // Firma exigida por useActionState (prevState, formData), sin usarlos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: StarterBudgetState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<StarterBudgetState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const created = await createStarterBudgetCore(projectId, project.type);
  if (created === 0) return { error: "Este presupuesto ya tiene categorías." };

  revalidatePath(`/app/${projectId}/presupuesto`);
  revalidatePath(`/app/${projectId}`);
  return undefined;
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
