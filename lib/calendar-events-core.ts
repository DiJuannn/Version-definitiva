import { prisma } from "@/lib/prisma";
import { CalendarEventType } from "@/lib/generated/prisma";

export async function createCalendarEventCore(
  organizationId: string,
  input: { title: string; date: Date; type?: string | null; projectId?: string | null; notes?: string | null },
): Promise<string | null> {
  const title = input.title.trim();
  if (!title || Number.isNaN(input.date.getTime())) return null;

  const project = input.projectId
    ? await prisma.project.findFirst({ where: { id: input.projectId, organizationId } })
    : null;

  const type = (Object.values(CalendarEventType) as string[]).includes(input.type ?? "")
    ? (input.type as CalendarEventType)
    : CalendarEventType.OTHER;

  const event = await prisma.calendarEvent.create({
    data: {
      organizationId,
      projectId: project?.id,
      title,
      type,
      date: input.date,
      notes: input.notes ?? null,
    },
  });
  return event.id;
}

export async function deleteCalendarEventCore(organizationId: string, eventId: string) {
  await prisma.calendarEvent.deleteMany({ where: { id: eventId, organizationId } });
}
