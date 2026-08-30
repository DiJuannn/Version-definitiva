"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { BreakdownCategory } from "@/lib/generated/prisma";

export async function createBreakdownElement(
  projectId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const name = String(formData.get("name") ?? "").trim();
  const categoryInput = String(formData.get("category") ?? "");
  if (!name || !(Object.values(BreakdownCategory) as string[]).includes(categoryInput)) {
    return;
  }

  await prisma.breakdownElement.create({
    data: {
      projectId,
      name,
      category: categoryInput as BreakdownCategory,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function deleteBreakdownElement(
  projectId: string,
  elementId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.breakdownElement.deleteMany({
    where: { id: elementId, projectId },
  });

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function createCrewMember(projectId: string, formData: FormData) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const personId = optionalString(formData.get("personId"));
  const person = personId
    ? await prisma.person.findFirst({
        where: { id: personId, organizationId: project.organizationId },
      })
    : null;

  const typedName = String(formData.get("name") ?? "").trim();
  const name =
    typedName || (person ? `${person.firstName} ${person.lastName ?? ""}`.trim() : "");
  if (!name) return;

  await prisma.crewMember.create({
    data: {
      projectId,
      personId: person?.id,
      name,
      role: optionalString(formData.get("role")) ?? person?.primaryRole ?? null,
      email: optionalString(formData.get("email")) ?? person?.email ?? null,
      phone: optionalString(formData.get("phone")) ?? person?.phone ?? null,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath(`/app/${projectId}/desglose`);
}

export async function deleteCrewMember(projectId: string, crewMemberId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await prisma.crewMember.deleteMany({
    where: { id: crewMemberId, projectId },
  });

  revalidatePath(`/app/${projectId}/desglose`);
}
