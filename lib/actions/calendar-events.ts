"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { CalendarEventType } from "@/lib/generated/prisma";

export async function createCalendarEvent(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const title = String(formData.get("title") ?? "").trim();
  const dateInput = String(formData.get("date") ?? "");
  const date = new Date(dateInput);
  if (!title || Number.isNaN(date.getTime())) return;

  const requestedProjectId = optionalString(formData.get("projectId"));
  const project = requestedProjectId
    ? await prisma.project.findFirst({
        where: { id: requestedProjectId, organizationId: profile.organizationId },
      })
    : null;

  const typeInput = String(formData.get("type") ?? "");
  const type = (Object.values(CalendarEventType) as string[]).includes(typeInput)
    ? (typeInput as CalendarEventType)
    : CalendarEventType.OTHER;

  await prisma.calendarEvent.create({
    data: {
      organizationId: profile.organizationId,
      projectId: project?.id,
      title,
      type,
      date,
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/app/calendario");
  revalidatePath("/app");
}

export async function deleteCalendarEvent(eventId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.calendarEvent.deleteMany({
    where: { id: eventId, organizationId: profile.organizationId },
  });

  revalidatePath("/app/calendario");
  revalidatePath("/app");
}
