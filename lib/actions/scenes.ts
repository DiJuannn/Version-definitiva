"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { DayPart, IntExt } from "@/lib/generated/prisma";

export async function createScene(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const number = String(formData.get("number") ?? "").trim();
  if (!number) return;

  const count = await prisma.scene.count({ where: { projectId } });
  const scene = await prisma.scene.create({
    data: { projectId, number, order: count },
  });

  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion/${scene.id}`);
}

export async function updateScene(
  projectId: string,
  sceneId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId },
  });
  if (!scene) return;

  const number = String(formData.get("number") ?? "").trim();
  if (!number) return;

  const intExtInput = String(formData.get("intExt") ?? "");
  const intExt = (Object.values(IntExt) as string[]).includes(intExtInput)
    ? (intExtInput as IntExt)
    : scene.intExt;

  const dayPartInput = String(formData.get("dayPart") ?? "");
  const dayPart = (Object.values(DayPart) as string[]).includes(dayPartInput)
    ? (dayPartInput as DayPart)
    : scene.dayPart;

  const requestedLocationId = optionalString(formData.get("locationId"));
  const requestedCharacterIds = formData.getAll("characterIds").map(String);
  const requestedBreakdownIds = formData
    .getAll("breakdownElementIds")
    .map(String);
  const requestedCrewIds = formData.getAll("crewMemberIds").map(String);

  const [location, validCharacters, validBreakdown, validCrew] =
    await Promise.all([
      requestedLocationId
        ? prisma.location.findFirst({
            where: { id: requestedLocationId, organizationId: project.organizationId },
          })
        : null,
      prisma.character.findMany({
        where: { projectId, id: { in: requestedCharacterIds } },
        select: { id: true },
      }),
      prisma.breakdownElement.findMany({
        where: { projectId, id: { in: requestedBreakdownIds } },
        select: { id: true },
      }),
      prisma.crewMember.findMany({
        where: { projectId, id: { in: requestedCrewIds } },
        select: { id: true },
      }),
    ]);

  await prisma.$transaction([
    prisma.scene.update({
      where: { id: sceneId },
      data: {
        number,
        intExt,
        dayPart,
        locationId: location?.id ?? null,
        storyOrder: (() => {
          const raw = formData.get("storyOrder");
          const num = raw ? Number(raw) : NaN;
          return Number.isFinite(num) ? num : null;
        })(),
        description: optionalString(formData.get("description")),
        action: optionalString(formData.get("action")),
        dialogueNotes: optionalString(formData.get("dialogueNotes")),
        extrasNotes: optionalString(formData.get("extrasNotes")),
        productionNotes: optionalString(formData.get("productionNotes")),
      },
    }),
    prisma.sceneCharacter.deleteMany({ where: { sceneId } }),
    prisma.sceneCharacter.createMany({
      data: validCharacters.map((c) => ({ sceneId, characterId: c.id })),
    }),
    prisma.sceneBreakdownElement.deleteMany({ where: { sceneId } }),
    prisma.sceneBreakdownElement.createMany({
      data: validBreakdown.map((b) => ({
        sceneId,
        breakdownElementId: b.id,
        condition: optionalString(formData.get(`condition_${b.id}`)),
      })),
    }),
    prisma.sceneCrewMember.deleteMany({ where: { sceneId } }),
    prisma.sceneCrewMember.createMany({
      data: validCrew.map((c) => ({ sceneId, crewMemberId: c.id })),
    }),
  ]);

  revalidatePath(`/app/${projectId}/guion`);
  revalidatePath(`/app/${projectId}/guion/${sceneId}`);
  revalidatePath(`/app/${projectId}/desglose`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje`);
}

export async function deleteScene(projectId: string, sceneId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.scene.deleteMany({ where: { id: sceneId, projectId } });
  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/${projectId}/guion`);
}
