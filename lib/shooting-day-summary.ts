import { prisma } from "@/lib/prisma";
import { syncProjectSchedule } from "@/lib/schedule-core";
import { computeDayTimeline, formatHHMM, type PlanBlock, type TimedBlock } from "@/lib/schedule-plan";

export async function getShootingDaySummary(shootingDayId: string) {
  // El orden de rodaje (bloques) tiene que estar al día antes de leerlo.
  const owner = await prisma.shootingDay.findUnique({ where: { id: shootingDayId }, select: { projectId: true } });
  if (!owner) return null;
  await syncProjectSchedule(owner.projectId);

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

  const [castOverrides, castOverrideRows, projectDays] = await Promise.all([
    prisma.shootingDaySceneCastOverride.findMany({ where: { shootingDayId }, select: { sceneId: true } }),
    prisma.shootingDaySceneCharacter.findMany({
      where: { shootingDayId },
      include: { character: { include: { actor: true } } },
    }),
    prisma.shootingDay.findMany({
      where: { projectId: shootingDay.projectId },
      orderBy: { date: "asc" },
      select: { id: true },
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

  const runOrder = await getRunOrder(shootingDayId, shootingDay.callTime ?? shootingDay.callSheet?.generalCallTime ?? null, shootingDay.prepMin, shootingDay.date);

  return {
    shootingDay,
    // Orden de rodaje con horas calculadas y la citación de cada personaje.
    runOrder,
    // "Día 2 de 5": jornada por orden de fecha dentro del proyecto.
    dayNumber: projectDays.findIndex((d) => d.id === shootingDayId) + 1,
    dayCount: projectDays.length,
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

export type RunOrder = {
  callTime: string | null;
  wrap: string | null;
  prepMin: number;
  blocks: (TimedBlock & { label: string; location: string | null })[];
  // characterId → citación (primer plano menos preparación) y hasta cuándo.
  castCalls: Record<string, { call: string; until: string }>;
};

async function getRunOrder(shootingDayId: string, callTime: string | null, prepMin: number | null, date: Date): Promise<RunOrder> {
  const rows = await prisma.scheduleBlock.findMany({
    where: { shootingDayId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      scene: {
        select: {
          id: true,
          number: true,
          intExt: true,
          dayPart: true,
          location: { select: { name: true, latitude: true, longitude: true } },
          characters: { select: { characterId: true } },
        },
      },
      shots: {
        orderBy: { blockOrder: "asc" },
        include: {
          characters: { select: { characterId: true } },
          scene: {
            select: {
              number: true,
              intExt: true,
              dayPart: true,
              location: { select: { name: true, latitude: true, longitude: true } },
              characters: { select: { characterId: true } },
            },
          },
        },
      },
    },
  });
  const blocks: PlanBlock[] = rows.map((b) => ({
    id: b.id,
    kind: b.kind,
    title: b.title,
    durationMin: b.durationMin,
    startTime: b.startTime,
    notes: b.notes,
    scene: b.kind === "SCENE" && b.scene
      ? { id: b.scene.id, number: b.scene.number, intExt: b.scene.intExt, dayPart: b.scene.dayPart, characterIds: b.scene.characters.map((c) => c.characterId), durationMin: null }
      : null,
    shots: b.shots.map((s) => ({
      id: s.id,
      sceneId: s.sceneId,
      sceneNumber: s.scene.number,
      number: s.number,
      shotSize: s.shotSize,
      movement: s.movement,
      description: s.description,
      estimatedMin: s.estimatedMin,
      intExt: s.scene.intExt,
      dayPart: s.scene.dayPart,
      characterIds: s.characters.length > 0 ? s.characters.map((c) => c.characterId) : s.scene.characters.map((c) => c.characterId),
      done: s.done,
    })),
  }));
  const located = rows
    .flatMap((r) => [r.scene?.location, ...r.shots.map((s) => s.scene.location)])
    .find((l) => l?.latitude != null && l?.longitude != null);
  const timeline = computeDayTimeline({ date, callTime, prepMin, blocks, lat: located?.latitude, lng: located?.longitude });
  const prep = prepMin ?? 45;
  let letter = 0;
  const labelled = timeline.blocks.map((b, i) => {
    const row = rows[i];
    const places = [...new Set([row.scene?.location?.name, ...row.shots.map((s) => s.scene.location?.name)].filter((x): x is string => Boolean(x)))];
    const filmed = b.kind === "SHOTS" || b.kind === "SCENE";
    const code = filmed ? String.fromCharCode(65 + (letter++ % 26)) : "";
    const label =
      b.kind === "MEAL" ? b.title || "Comida"
      : b.kind === "MOVE" ? b.title || "Cambio de set"
      : b.kind === "NOTE" ? b.title || "Nota"
      : `Bloque ${code}${b.title ? ` · ${b.title}` : places.length ? ` · ${places.join(" / ")}` : ""}`;
    return { ...b, label, location: places[0] ?? null };
  });
  const hasContent = blocks.some((b) => b.shots.length > 0 || b.scene);
  const castCalls: RunOrder["castCalls"] = {};
  for (const [id, w] of timeline.characterWindows) {
    castCalls[id] = { call: formatHHMM(Math.max(w.first - prep, timeline.callTime ?? w.first - prep)), until: formatHHMM(w.last) };
  }
  return {
    callTime: timeline.callTime !== null ? formatHHMM(timeline.callTime) : null,
    wrap: hasContent ? formatHHMM(timeline.wrap) : null,
    prepMin: prep,
    blocks: hasContent ? labelled : [],
    castCalls,
  };
}
