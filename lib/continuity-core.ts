import { prisma } from "@/lib/prisma";
import { analyzeContinuity, type ContinuitySceneInput } from "@/lib/mistral";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { ContinuityIssueStatus } from "@/lib/generated/prisma";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { isProjectOwnerPro } from "@/lib/project-plan";
import * as Sentry from "@sentry/nextjs";

export async function runContinuityCheckCore(
  projectId: string,
  organizationId: string,
): Promise<{ checkId: string } | { error: string }> {
  if (!(await isProjectOwnerPro(organizationId))) {
    return { error: "El detector de continuidad es una función de PRO." };
  }

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    include: {
      location: true,
      characters: { include: { character: true } },
      breakdownElements: { include: { breakdownElement: true } },
    },
  });

  if (scenes.length === 0) {
    return { error: "Añade escenas antes de revisar la continuidad." };
  }

  const ordered = [...scenes].sort(
    (a, b) => (a.storyOrder ?? a.order) - (b.storyOrder ?? b.order),
  );

  const payload: ContinuitySceneInput[] = ordered.map((scene) => ({
    number: scene.number,
    intExt: INT_EXT_LABELS[scene.intExt],
    dayPart: DAY_PART_LABELS[scene.dayPart],
    locationName: scene.location?.name ?? null,
    characterNames: scene.characters.map((c) => c.character.name),
    items: scene.breakdownElements.map((b) => ({
      name: b.breakdownElement.name,
      category: b.breakdownElement.category,
      condition: b.condition,
    })),
    description: scene.description,
    action: scene.action,
  }));

  let issues;
  try {
    issues = await withMistralSlot(() => analyzeContinuity(payload));
  } catch (error) {
    if (error instanceof MistralBusyError) {
      return {
        error: "Hay varios análisis en marcha ahora mismo. Inténtalo de nuevo en unos segundos.",
      };
    }
    console.error("runContinuityCheckCore: fallo llamando a Mistral", error);
    Sentry.captureException(error, {
      tags: { area: "mistral", action: "runContinuityCheck" },
      extra: { projectId },
    });
    return {
      error:
        "La IA no está disponible en este momento. Tus datos están seguros — inténtalo de nuevo en un rato.",
    };
  }

  const check = await prisma.continuityCheck.create({
    data: {
      projectId,
      issues: {
        create: issues.map((issue) => ({
          type: issue.type,
          title: issue.title,
          description: issue.description,
          sceneNumbers: issue.sceneNumbers,
        })),
      },
    },
  });

  return { checkId: check.id };
}

export async function updateContinuityIssueStatusCore(
  projectId: string,
  checkId: string,
  issueId: string,
  status: ContinuityIssueStatus,
) {
  await prisma.continuityIssue.updateMany({
    where: { id: issueId, checkId, check: { projectId } },
    data: { status },
  });

  const remainingOpen = await prisma.continuityIssue.count({
    where: { checkId, status: ContinuityIssueStatus.OPEN, check: { projectId } },
  });
  if (remainingOpen === 0) {
    await prisma.continuityCheck.updateMany({
      where: { id: checkId, projectId },
      data: { status: "REVIEWED", reviewedAt: new Date() },
    });
  }
}
