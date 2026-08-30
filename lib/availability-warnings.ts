import { prisma } from "@/lib/prisma";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";

export async function getAvailabilityWarnings(summary: ShootingDaySummary) {
  const personIds = new Set<string>();
  for (const character of summary.characters) {
    if (character.actor?.personId) personIds.add(character.actor.personId);
  }
  for (const crewMember of summary.crewMembers) {
    if (crewMember.personId) personIds.add(crewMember.personId);
  }
  if (personIds.size === 0) return [];

  const date = summary.shootingDay.date;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const unavailable = await prisma.personAvailability.findMany({
    where: {
      personId: { in: [...personIds] },
      status: "UNAVAILABLE",
      date: { gte: dayStart, lt: dayEnd },
    },
    include: { person: true },
  });

  return unavailable.map((entry) => ({
    id: entry.id,
    personName: `${entry.person.firstName} ${entry.person.lastName ?? ""}`.trim(),
    note: entry.note,
  }));
}
