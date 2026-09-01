import { prisma } from "@/lib/prisma";
import { ProjectStatus } from "@/lib/generated/prisma";

const VALID_STATUSES = new Set<string>(Object.values(ProjectStatus));

export type UpdateProjectDetailsInput = {
  name: string;
  type: string | null;
  status: string | null;
  director: string | null;
  producer: string | null;
  durationLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetTarget: number | null;
  notes: string | null;
};

function normalizeString(value: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(value: string | null): Date | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Compartido por la Server Action de la web (lib/actions/project-details.ts)
// y la ruta PATCH de la app móvil — igual que el resto de acciones que
// tienen equivalente en ambos sitios (ver lib/clapboard-core.ts).
export async function updateProjectDetailsCore(
  projectId: string,
  currentStatus: ProjectStatus,
  input: UpdateProjectDetailsInput,
) {
  const name = normalizeString(input.name);
  if (!name) return;

  const status =
    input.status && VALID_STATUSES.has(input.status)
      ? (input.status as ProjectStatus)
      : currentStatus;

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name,
      type: normalizeString(input.type),
      director: normalizeString(input.director),
      producer: normalizeString(input.producer),
      durationLabel: normalizeString(input.durationLabel),
      status,
      startDate: normalizeDate(input.startDate),
      endDate: normalizeDate(input.endDate),
      budgetTarget:
        typeof input.budgetTarget === "number" && Number.isFinite(input.budgetTarget)
          ? input.budgetTarget
          : null,
      notes: normalizeString(input.notes),
    },
  });
}
