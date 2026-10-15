import { prisma } from "@/lib/prisma";

export async function createShotCore(
  projectId: string,
  sceneId: string,
  input: { number: string; shotSize?: string | null; description?: string | null },
): Promise<string | null> {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) return null;

  const number = input.number.trim();
  if (!number) return null;

  const [count, sceneCharacters] = await Promise.all([
    prisma.shot.count({ where: { sceneId } }),
    prisma.sceneCharacter.findMany({ where: { sceneId }, select: { characterId: true } }),
  ]);
  const shot = await prisma.shot.create({
    data: {
      sceneId,
      number,
      shotSize: input.shotSize ?? null,
      description: input.description ?? null,
      order: count,
      // Arranca con el reparto de la escena (editable después) — así la
      // hoja de llamada tiene algo sensato desde el primer momento, sin
      // obligar a configurar el plano antes de que sirva de nada.
      characters: sceneCharacters.length > 0
        ? { create: sceneCharacters.map((sc) => ({ characterId: sc.characterId })) }
        : undefined,
    },
  });
  return shot.id;
}

export type UpdateShotInput = {
  number: string;
  shotType?: string | null;
  shotSize?: string | null;
  angle?: string | null;
  movement?: string | null;
  camera?: string | null;
  lens?: string | null;
  fps?: number | null;
  durationSec?: number | null;
  description?: string | null;
  audio?: string | null;
  notes?: string | null;
};

export async function updateShotCore(
  projectId: string,
  shotId: string,
  input: UpdateShotInput,
): Promise<boolean> {
  const shot = await prisma.shot.findFirst({ where: { id: shotId, scene: { projectId } } });
  if (!shot) return false;

  const number = input.number.trim();
  if (!number) return false;

  await prisma.shot.update({
    where: { id: shotId },
    data: {
      number,
      shotType: input.shotType ?? null,
      shotSize: input.shotSize ?? null,
      angle: input.angle ?? null,
      movement: input.movement ?? null,
      camera: input.camera ?? null,
      lens: input.lens ?? null,
      fps: input.fps ?? null,
      durationSec: input.durationSec ?? null,
      description: input.description ?? null,
      audio: input.audio ?? null,
      notes: input.notes ?? null,
    },
  });
  return true;
}

export async function deleteShotCore(projectId: string, shotId: string) {
  await prisma.shot.deleteMany({ where: { id: shotId, scene: { projectId } } });
}

// Qué personajes de la escena salen de verdad en este plano — decide a
// quién cita la hoja de llamada cuando el día solo rueda algunos planos.
export async function updateShotCharactersCore(
  projectId: string,
  shotId: string,
  characterIds: string[],
): Promise<boolean> {
  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
    select: { sceneId: true },
  });
  if (!shot) return false;

  // Solo personajes que de verdad son de esa escena — lo que llegue de
  // fuera se descarta en silencio en vez de fallar.
  const validIds = new Set(
    (
      await prisma.sceneCharacter.findMany({
        where: { sceneId: shot.sceneId, characterId: { in: characterIds } },
        select: { characterId: true },
      })
    ).map((sc) => sc.characterId),
  );

  await prisma.$transaction([
    prisma.shotCharacter.deleteMany({ where: { shotId } }),
    ...(validIds.size > 0
      ? [
          prisma.shotCharacter.createMany({
            data: [...validIds].map((characterId) => ({ shotId, characterId })),
          }),
        ]
      : []),
  ]);
  return true;
}

export type GuidedShotInput = {
  shotSize: string | null;
  angle: string | null;
  movement: string | null;
  description: string | null;
  // Qué se oye (diálogo, efectos, música) y cuánto dura, para el guion técnico.
  audio?: string | null;
  durationSec?: number | null;
  // Quién sale; si no se dice, todo el reparto de la escena.
  characterIds?: string[];
};

// Varios planos a la vez para una escena (constructor de planos y coberturas
// rápidas). Se numeran detrás del último plano numérico de la escena.
export async function createGuidedShotsCore(
  projectId: string,
  sceneId: string,
  shots: GuidedShotInput[],
): Promise<number> {
  const scene = await prisma.scene.findFirst({
    where: { id: sceneId, projectId },
    select: {
      id: true,
      characters: { select: { characterId: true } },
      shots: { select: { number: true } },
    },
  });
  if (!scene || shots.length === 0) return 0;
  const sceneCast = scene.characters.map((c) => c.characterId);
  const allowed = new Set(sceneCast);
  let next = Math.max(0, ...scene.shots.map((s) => Number.parseInt(s.number, 10)).filter(Number.isFinite)) + 1;
  let order = scene.shots.length;
  const clean = (v: string | null) => v?.trim().slice(0, 200) || null;

  await prisma.$transaction(
    shots.slice(0, 30).map((s) => {
      const cast = (s.characterIds ?? sceneCast).filter((id) => allowed.has(id));
      return prisma.shot.create({
        data: {
          sceneId,
          number: String(next++),
          order: order++,
          shotSize: clean(s.shotSize),
          angle: clean(s.angle),
          movement: clean(s.movement),
          description: clean(s.description),
          audio: s.audio?.trim().slice(0, 2000) || null,
          durationSec: s.durationSec && s.durationSec > 0 ? Math.min(Math.round(s.durationSec), 3600) : null,
          characters: cast.length ? { create: cast.map((characterId) => ({ characterId })) } : undefined,
        },
      });
    }),
  );
  return Math.min(shots.length, 30);
}
