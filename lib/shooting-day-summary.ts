import { prisma } from "@/lib/prisma";

export async function getShootingDaySummary(shootingDayId: string) {
  const shootingDay = await prisma.shootingDay.findUnique({
    where: { id: shootingDayId },
    include: {
      scenes: {
        orderBy: { order: "asc" },
        include: {
          scene: {
            include: {
              location: true,
              characters: { include: { character: { include: { actor: true } } } },
              breakdownElements: { include: { breakdownElement: true } },
              crewMembers: { include: { crewMember: true } },
            },
          },
        },
      },
      callSheet: true,
    },
  });
  if (!shootingDay) return null;

  const scenes = shootingDay.scenes.map((s) => s.scene);

  const locationsMap = new Map<string, (typeof scenes)[number]["location"]>();
  const charactersMap = new Map<
    string,
    (typeof scenes)[number]["characters"][number]["character"]
  >();
  const crewMap = new Map<
    string,
    (typeof scenes)[number]["crewMembers"][number]["crewMember"]
  >();
  const breakdownMap = new Map<
    string,
    (typeof scenes)[number]["breakdownElements"][number]["breakdownElement"]
  >();

  for (const scene of scenes) {
    if (scene.location) locationsMap.set(scene.location.id, scene.location);
    for (const sc of scene.characters) {
      charactersMap.set(sc.character.id, sc.character);
    }
    for (const scm of scene.crewMembers) {
      crewMap.set(scm.crewMember.id, scm.crewMember);
    }
    for (const sbe of scene.breakdownElements) {
      breakdownMap.set(sbe.breakdownElement.id, sbe.breakdownElement);
    }
  }

  return {
    shootingDay,
    sceneAssignments: shootingDay.scenes,
    locations: [...locationsMap.values()].filter(
      (l): l is NonNullable<typeof l> => Boolean(l),
    ),
    characters: [...charactersMap.values()],
    crewMembers: [...crewMap.values()],
    breakdownElements: [...breakdownMap.values()],
  };
}

export type ShootingDaySummary = NonNullable<
  Awaited<ReturnType<typeof getShootingDaySummary>>
>;
