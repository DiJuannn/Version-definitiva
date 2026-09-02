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

  const count = await prisma.shot.count({ where: { sceneId } });
  const shot = await prisma.shot.create({
    data: {
      sceneId,
      number,
      shotSize: input.shotSize ?? null,
      description: input.description ?? null,
      order: count,
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
