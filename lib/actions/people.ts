"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalDecimal, optionalString } from "@/lib/form-utils";
import { uploadProjectFile } from "@/lib/storage";

function parseOtherRoles(formData: FormData): string[] {
  const raw = String(formData.get("otherRoles") ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((role) => role.trim())
    .filter(Boolean);
}

export async function createPerson(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return;

  await prisma.person.create({
    data: {
      organizationId: profile.organizationId,
      firstName,
      lastName: optionalString(formData.get("lastName")),
      primaryRole: optionalString(formData.get("primaryRole")),
      otherRoles: parseOtherRoles(formData),
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      address: optionalString(formData.get("address")),
      notes: optionalString(formData.get("notes")),
      rate: optionalDecimal(formData.get("rate")),
    },
  });

  revalidatePath("/app/equipo");
}

export async function updatePerson(personId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const firstName = String(formData.get("firstName") ?? "").trim();
  if (!firstName) return;

  await prisma.person.updateMany({
    where: { id: personId, organizationId: profile.organizationId },
    data: {
      firstName,
      lastName: optionalString(formData.get("lastName")),
      primaryRole: optionalString(formData.get("primaryRole")),
      otherRoles: parseOtherRoles(formData),
      email: optionalString(formData.get("email")),
      phone: optionalString(formData.get("phone")),
      address: optionalString(formData.get("address")),
      notes: optionalString(formData.get("notes")),
      rate: optionalDecimal(formData.get("rate")),
    },
  });

  revalidatePath("/app/equipo");
  revalidatePath(`/app/equipo/${personId}`);
}

export async function uploadPersonPhoto(personId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  const person = await prisma.person.findFirst({
    where: { id: personId, organizationId: profile.organizationId },
  });
  if (!person) return;

  const uploaded = await uploadProjectFile(profile.organizationId, file);
  if (!uploaded) return;

  await prisma.person.update({
    where: { id: personId },
    data: { photoUrl: uploaded.url },
  });

  revalidatePath(`/app/equipo/${personId}`);
}

export async function deletePerson(personId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.person.deleteMany({
    where: { id: personId, organizationId: profile.organizationId },
  });

  revalidatePath("/app/equipo");
}
