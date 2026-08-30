import { prisma } from "@/lib/prisma";

export type DayConflict = {
  personName: string;
  reason: string;
};

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function getProjectScheduleConflicts(
  projectId: string,
): Promise<Map<string, DayConflict[]>> {
  const days = await prisma.shootingDay.findMany({
    where: { projectId },
    select: {
      id: true,
      date: true,
      scenes: {
        select: {
          scene: {
            select: {
              location: { select: { name: true } },
              characters: {
                select: {
                  character: {
                    select: {
                      actor: { select: { id: true, name: true, personId: true } },
                    },
                  },
                },
              },
              crewMembers: {
                select: {
                  crewMember: { select: { id: true, name: true, personId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const personIds = new Set<string>();
  for (const day of days) {
    for (const { scene } of day.scenes) {
      for (const { character } of scene.characters) {
        if (character.actor?.personId) personIds.add(character.actor.personId);
      }
      for (const { crewMember } of scene.crewMembers) {
        if (crewMember.personId) personIds.add(crewMember.personId);
      }
    }
  }

  const unavailability = personIds.size
    ? await prisma.personAvailability.findMany({
        where: { personId: { in: [...personIds] }, status: "UNAVAILABLE" },
        select: { personId: true, date: true },
      })
    : [];

  const result = new Map<string, DayConflict[]>();

  for (const day of days) {
    const conflicts: DayConflict[] = [];
    const byActor = new Map<string, { name: string; personId: string | null; locations: Set<string> }>();
    const byCrew = new Map<string, { name: string; personId: string | null; locations: Set<string> }>();

    for (const { scene } of day.scenes) {
      const locationName = scene.location?.name ?? "sin localización";
      for (const { character } of scene.characters) {
        if (!character.actor) continue;
        const entry = byActor.get(character.actor.id) ?? {
          name: character.actor.name,
          personId: character.actor.personId,
          locations: new Set<string>(),
        };
        entry.locations.add(locationName);
        byActor.set(character.actor.id, entry);
      }
      for (const { crewMember } of scene.crewMembers) {
        const entry = byCrew.get(crewMember.id) ?? {
          name: crewMember.name,
          personId: crewMember.personId,
          locations: new Set<string>(),
        };
        entry.locations.add(locationName);
        byCrew.set(crewMember.id, entry);
      }
    }

    for (const { name, personId, locations } of [...byActor.values(), ...byCrew.values()]) {
      if (locations.size > 1) {
        conflicts.push({
          personName: name,
          reason: `en ${locations.size} localizaciones distintas el mismo día`,
        });
      }
      if (personId && unavailability.some((u) => u.personId === personId && isSameDay(u.date, day.date))) {
        conflicts.push({
          personName: name,
          reason: "marcado como no disponible este día",
        });
      }
    }

    result.set(day.id, conflicts);
  }

  return result;
}
