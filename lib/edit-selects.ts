import { prisma } from "@/lib/prisma";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

// Montaje → Selección: qué tomas quedaron marcadas como buenas en el Parte de script, organizadas
// por escena (no por día de rodaje, que es como las ve el Parte de script) — así es como se le
// entrega a quien monta. No se guarda nada nuevo: se reaprovecha lo que ya apuntó la claqueta.

export type SelectTake = { take: number; notes: string | null };
export type SelectShot = {
  key: string;
  label: string;
  size: string | null;
  description: string | null;
  goodTakes: SelectTake[];
};
export type SelectScene = {
  sceneNumber: string;
  context: string | null;
  shots: SelectShot[];
  // Escenas rodadas (tienen alguna toma) pero sin ninguna marcada como buena todavía.
  hasAnyGood: boolean;
};

export type EditSelects = {
  scenes: SelectScene[];
  scenesWithGood: number;
  scenesShot: number;
};

const norm = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export async function getEditSelects(projectId: string): Promise<EditSelects> {
  const [scenes, logs] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          select: { number: true, shotSize: true, description: true },
        },
      },
    }),
    prisma.clapLog.findMany({
      where: { projectId },
      orderBy: { take: "asc" },
      select: { sceneNumber: true, shotNumber: true, take: true, good: true, notes: true },
    }),
  ]);

  const sceneByNumber = new Map(scenes.map((sc) => [norm(sc.number), sc]));
  const contextOf = (sc: (typeof scenes)[number] | undefined) =>
    sc
      ? [INT_EXT_LABELS[sc.intExt], DAY_PART_LABELS[sc.dayPart], sc.location?.name].filter(Boolean).join(" · ")
      : null;

  const bySceneNumber = new Map<string, Map<string, SelectShot>>();
  const anyLogBySceneNumber = new Map<string, boolean>();

  for (const log of logs) {
    anyLogBySceneNumber.set(log.sceneNumber, true);
    if (!log.good) continue;

    const shotsOfScene = bySceneNumber.get(log.sceneNumber) ?? new Map<string, SelectShot>();
    bySceneNumber.set(log.sceneNumber, shotsOfScene);

    const shotKey = norm(log.shotNumber) || "__none__";
    let shot = shotsOfScene.get(shotKey);
    if (!shot) {
      const scene = sceneByNumber.get(norm(log.sceneNumber));
      const listed = log.shotNumber ? scene?.shots.find((sh) => norm(sh.number) === norm(log.shotNumber)) : undefined;
      shot = {
        key: shotKey,
        label: log.shotNumber ? `${log.sceneNumber}.${log.shotNumber}` : `Escena ${log.sceneNumber}`,
        size: listed?.shotSize ?? null,
        description: listed?.description ?? null,
        goodTakes: [],
      };
      shotsOfScene.set(shotKey, shot);
    }
    shot.goodTakes.push({ take: log.take, notes: log.notes });
  }

  // Todas las escenas con alguna toma registrada, en el orden del guion (las que no están en el
  // guion —borradas después de la claqueta— van al final, por número).
  const sceneNumbers = new Set<string>([...anyLogBySceneNumber.keys()]);
  const ordered = [
    ...scenes.filter((sc) => sceneNumbers.has(sc.number)),
    ...[...sceneNumbers]
      .filter((num) => !sceneByNumber.has(norm(num)))
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
      .map((num) => ({ id: num, number: num, intExt: "INT" as const, dayPart: "DAY" as const, location: null, shots: [] })),
  ];

  const result: SelectScene[] = ordered.map((sc) => {
    const shots = [...(bySceneNumber.get(sc.number)?.values() ?? [])];
    return {
      sceneNumber: sc.number,
      context: contextOf(scenes.find((s) => s.id === sc.id)),
      shots,
      hasAnyGood: shots.length > 0,
    };
  });

  return {
    scenes: result,
    scenesWithGood: result.filter((s) => s.hasAnyGood).length,
    scenesShot: sceneNumbers.size,
  };
}
