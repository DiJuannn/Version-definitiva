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
              // Solo los planos que se ruedan este día (una escena puede repartirse en varios).
              shots: {
                where: { shootingDayId },
                orderBy: [{ order: "asc" }, { number: "asc" }],
                include: {
                  characters: { include: { character: { include: { actor: true } } } },
                },
              },
            },
          },
        },
      },
      callSheet: { include: { crewCited: { include: { crewMember: true } } } },
    },
  });
  if (!shootingDay) return null;

  const [castOverrides, castOverrideRows] = await Promise.all([
    prisma.shootingDaySceneCastOverride.findMany({ where: { shootingDayId }, select: { sceneId: true } }),
    prisma.shootingDaySceneCharacter.findMany({
      where: { shootingDayId },
      include: { character: { include: { actor: true } } },
    }),
  ]);
  const overriddenSceneIds = new Set(castOverrides.map((o) => o.sceneId));
  const overrideCharactersBySceneId = new Map<string, typeof castOverrideRows>();
  for (const row of castOverrideRows) {
    const list = overrideCharactersBySceneId.get(row.sceneId) ?? [];
    list.push(row);
    overrideCharactersBySceneId.set(row.sceneId, list);
  }

  const scenes = shootingDay.scenes.map((s) => s.scene);
  type SceneCharacters = (typeof scenes)[number]["characters"];

  // Qué personajes cita la hoja de llamada por cada escena asignada ese día,
  // por orden de prioridad:
  // 1. Corrección manual desde la propia hoja de llamada (ShootingDaySceneCastOverride) —
  //    tiene la última palabra, aunque quede vacía a propósito.
  // 2. Si se han repartido planos concretos para el día (plan de rodaje por
  //    planos), solo los personajes de ESOS planos — no todo el reparto de
  //    la escena, que puede incluir gente que no sale ese día.
  // 3. Sin nada de lo anterior, el reparto completo de la escena de siempre.
  const charactersByAssignment = new Map<string, SceneCharacters>();
  for (const assignment of shootingDay.scenes) {
    if (overriddenSceneIds.has(assignment.sceneId)) {
      charactersByAssignment.set(
        assignment.id,
        (overrideCharactersBySceneId.get(assignment.sceneId) ?? []) as unknown as SceneCharacters,
      );
      continue;
    }
    const dayShots = assignment.scene.shots;
    if (dayShots.length === 0) {
      charactersByAssignment.set(assignment.id, assignment.scene.characters);
      continue;
    }
    const byId = new Map<string, SceneCharacters[number]>();
    for (const shot of dayShots) {
      for (const sc of shot.characters) {
        byId.set(sc.character.id, sc as unknown as SceneCharacters[number]);
      }
    }
    charactersByAssignment.set(assignment.id, [...byId.values()]);
  }

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
    for (const sbe of scene.breakdownElements) {
      breakdownMap.set(sbe.breakdownElement.id, sbe.breakdownElement);
    }
  }
  // El elenco global del día es la unión de lo que cita cada escena ya
  // filtrado por plano/corrección manual (charactersByAssignment), no el
  // reparto completo de todas las escenas del día.
  for (const characters of charactersByAssignment.values()) {
    for (const sc of characters) {
      charactersMap.set(sc.character.id, sc.character);
    }
  }

  // Equipo técnico: corrección manual desde la hoja de llamada (todo el
  // día, no por escena) si existe; si no, el de siempre (unión del equipo
  // de todas las escenas del día).
  const crewOverridden = shootingDay.callSheet?.crewOverridden ?? false;
  if (crewOverridden) {
    for (const cited of shootingDay.callSheet?.crewCited ?? []) {
      crewMap.set(cited.crewMember.id, cited.crewMember);
    }
  } else {
    for (const scene of scenes) {
      for (const scm of scene.crewMembers) {
        crewMap.set(scm.crewMember.id, scm.crewMember);
      }
    }
  }

  return {
    shootingDay,
    sceneAssignments: shootingDay.scenes,
    charactersByAssignment,
    overriddenSceneIds,
    locations: [...locationsMap.values()].filter(
      (l): l is NonNullable<typeof l> => Boolean(l),
    ),
    characters: [...charactersMap.values()],
    crewMembers: [...crewMap.values()],
    crewOverridden,
    breakdownElements: [...breakdownMap.values()],
  };
}

export type ShootingDaySummary = NonNullable<
  Awaited<ReturnType<typeof getShootingDaySummary>>
>;
