import { prisma } from "@/lib/prisma";
import { EditCutStatus } from "@/lib/generated/prisma";

// Montaje → Cortes: compartido por la Server Action de la web y la ruta de la app.

export type EditCutInput = {
  name: string;
  durationLabel: string | null;
  date: Date | null;
  status: string | null;
  notes: string | null;
};

const VALID_STATUSES = new Set<string>(Object.values(EditCutStatus));

function resolveStatus(value: string | null): EditCutStatus {
  return value && VALID_STATUSES.has(value) ? (value as EditCutStatus) : "DRAFT";
}

export async function createEditCutCore(projectId: string, input: EditCutInput): Promise<{ id: string } | null> {
  const name = input.name.trim();
  if (!name) return null;

  const order = await prisma.editCut.count({ where: { projectId } });
  const cut = await prisma.editCut.create({
    data: {
      projectId,
      name,
      durationLabel: input.durationLabel?.trim() || null,
      date: input.date,
      status: resolveStatus(input.status),
      notes: input.notes?.trim() || null,
      order,
    },
  });
  return { id: cut.id };
}

export async function updateEditCutCore(
  projectId: string,
  cutId: string,
  input: Partial<EditCutInput>,
): Promise<boolean> {
  const existing = await prisma.editCut.findFirst({ where: { id: cutId, projectId } });
  if (!existing) return false;

  await prisma.editCut.update({
    where: { id: cutId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() || existing.name } : {}),
      ...(input.durationLabel !== undefined ? { durationLabel: input.durationLabel?.trim() || null } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.status !== undefined ? { status: resolveStatus(input.status) } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });
  return true;
}

export async function deleteEditCutCore(projectId: string, cutId: string): Promise<boolean> {
  const result = await prisma.editCut.deleteMany({ where: { id: cutId, projectId } });
  return result.count > 0;
}

export async function listEditCutsCore(projectId: string) {
  return prisma.editCut.findMany({ where: { projectId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
}
