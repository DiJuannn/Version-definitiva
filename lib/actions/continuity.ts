"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { analyzeContinuity, type ContinuitySceneInput } from "@/lib/mistral";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { ContinuityIssueStatus } from "@/lib/generated/prisma";

export async function runContinuityCheck(projectId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    include: {
      location: true,
      characters: { include: { character: true } },
      breakdownElements: { include: { breakdownElement: true } },
    },
  });

  if (scenes.length === 0) return;

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

  const issues = await analyzeContinuity(payload);

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

  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion/continuidad/${check.id}`);
}

export async function updateContinuityIssueStatus(
  projectId: string,
  checkId: string,
  issueId: string,
  status: ContinuityIssueStatus,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.continuityIssue.updateMany({
    where: { id: issueId, checkId, check: { projectId } },
    data: { status },
  });

  const remainingOpen = await prisma.continuityIssue.count({
    where: { checkId, status: ContinuityIssueStatus.OPEN },
  });
  if (remainingOpen === 0) {
    await prisma.continuityCheck.update({
      where: { id: checkId },
      data: { status: "REVIEWED", reviewedAt: new Date() },
    });
  }

  revalidatePath(`/app/${projectId}/guion/continuidad/${checkId}`);
  revalidatePath(`/app/${projectId}/guion`);
}
