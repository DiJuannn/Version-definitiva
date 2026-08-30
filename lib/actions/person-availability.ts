"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { PersonAvailabilityStatus } from "@/lib/generated/prisma";

export async function setPersonAvailability(personId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const person = await prisma.person.findFirst({
    where: { id: personId, organizationId: profile.organizationId },
  });
  if (!person) return;

  const dateInput = String(formData.get("date") ?? "");
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return;

  const statusInput = String(formData.get("status") ?? "");
  if (!(Object.values(PersonAvailabilityStatus) as string[]).includes(statusInput)) {
    return;
  }

  await prisma.personAvailability.upsert({
    where: { personId_date: { personId, date } },
    create: {
      personId,
      date,
      status: statusInput as PersonAvailabilityStatus,
      note: optionalString(formData.get("note")),
    },
    update: {
      status: statusInput as PersonAvailabilityStatus,
      note: optionalString(formData.get("note")),
    },
  });

  revalidatePath(`/app/equipo/${personId}`);
}

export async function deletePersonAvailability(
  personId: string,
  availabilityId: string,
) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const person = await prisma.person.findFirst({
    where: { id: personId, organizationId: profile.organizationId },
  });
  if (!person) return;

  await prisma.personAvailability.deleteMany({
    where: { id: availabilityId, personId },
  });

  revalidatePath(`/app/equipo/${personId}`);
}
