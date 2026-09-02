"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { createCalendarEventCore, deleteCalendarEventCore } from "@/lib/calendar-events-core";

export async function createCalendarEvent(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await createCalendarEventCore(profile.organizationId, {
    title: String(formData.get("title") ?? "").trim(),
    date: new Date(String(formData.get("date") ?? "")),
    type: String(formData.get("type") ?? ""),
    projectId: optionalString(formData.get("projectId")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath("/app/calendario");
  revalidatePath("/app");
}

export async function deleteCalendarEvent(eventId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await deleteCalendarEventCore(profile.organizationId, eventId);

  revalidatePath("/app/calendario");
  revalidatePath("/app");
}
