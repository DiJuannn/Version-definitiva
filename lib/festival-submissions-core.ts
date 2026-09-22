import { prisma } from "@/lib/prisma";
import { FestivalSubmissionStatus } from "@/lib/generated/prisma";

// Festivales → seguimiento de envíos: compartido por la Server Action de la web y la ruta de la app.

export type FestivalSubmissionInput = {
  festivalName: string;
  deadline: Date | null;
  submittedAt: Date | null;
  fee: number | null;
  status: string | null;
  url: string | null;
  notes: string | null;
};

const VALID_STATUSES = new Set<string>(Object.values(FestivalSubmissionStatus));

function resolveStatus(value: string | null): FestivalSubmissionStatus {
  return value && VALID_STATUSES.has(value) ? (value as FestivalSubmissionStatus) : "PLANNED";
}

export async function createFestivalSubmissionCore(
  projectId: string,
  input: FestivalSubmissionInput,
): Promise<{ id: string } | null> {
  const festivalName = input.festivalName.trim();
  if (!festivalName) return null;

  const submission = await prisma.festivalSubmission.create({
    data: {
      projectId,
      festivalName,
      deadline: input.deadline,
      submittedAt: input.submittedAt,
      fee: input.fee ?? null,
      status: resolveStatus(input.status),
      url: input.url?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  return { id: submission.id };
}

export async function updateFestivalSubmissionCore(
  projectId: string,
  submissionId: string,
  input: Partial<FestivalSubmissionInput>,
): Promise<boolean> {
  const existing = await prisma.festivalSubmission.findFirst({ where: { id: submissionId, projectId } });
  if (!existing) return false;

  await prisma.festivalSubmission.update({
    where: { id: submissionId },
    data: {
      ...(input.festivalName !== undefined ? { festivalName: input.festivalName.trim() || existing.festivalName } : {}),
      ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
      ...(input.submittedAt !== undefined ? { submittedAt: input.submittedAt } : {}),
      ...(input.fee !== undefined ? { fee: input.fee } : {}),
      ...(input.status !== undefined ? { status: resolveStatus(input.status) } : {}),
      ...(input.url !== undefined ? { url: input.url?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    },
  });
  return true;
}

export async function deleteFestivalSubmissionCore(projectId: string, submissionId: string): Promise<boolean> {
  const result = await prisma.festivalSubmission.deleteMany({ where: { id: submissionId, projectId } });
  return result.count > 0;
}

export async function listFestivalSubmissionsCore(projectId: string) {
  return prisma.festivalSubmission.findMany({
    where: { projectId },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
  });
}
