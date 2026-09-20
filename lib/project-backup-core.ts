import { randomUUID } from "crypto";
import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

// Copia automática de lo que sale del guion: escenas (con sus planos, viñetas
// de storyboard y vínculos con personajes, desglose, equipo y días de rodaje),
// personajes y elementos de desglose. Se guarda justo antes de una acción que lo
// borra (reemplazar el guion, "eliminar todas las escenas") y se puede
// restaurar desde Guion. Lo que no depende del guion (actores, equipo,
// presupuesto, días, tareas, documentos, tomas de la claqueta) no entra: no se
// borra al reemplazar, así que no hace falta copiarlo.

const BACKUPS_TO_KEEP = 8;

export const BACKUP_REASON_LABELS: Record<string, string> = {
  "script-replace": "Antes de reemplazar el guion",
  "delete-all-scenes": "Antes de eliminar todas las escenas",
  "before-restore": "Antes de restaurar otra copia",
};

type BackupShot = {
  number: string;
  shotType: string | null;
  shotSize: string | null;
  angle: string | null;
  movement: string | null;
  camera: string | null;
  lens: string | null;
  fps: number | null;
  durationSec: number | null;
  description: string | null;
  audio: string | null;
  notes: string | null;
  order: number;
  shootingDayId: string | null;
  done: boolean;
  frames: { imageUrl: string | null; description: string | null; order: number }[];
};

type BackupScene = {
  id: string;
  number: string;
  intExt: string;
  dayPart: string;
  locationId: string | null;
  description: string | null;
  action: string | null;
  dialogueNotes: string | null;
  extrasNotes: string | null;
  productionNotes: string | null;
  order: number;
  storyOrder: number | null;
  characterIds: string[];
  breakdown: { id: string; condition: string | null }[];
  crewIds: string[];
  days: { dayId: string; callTime: string | null; order: number }[];
  clapLogIds: string[];
  shots: BackupShot[];
};

export type ScriptBackupData = {
  v: 1;
  characters: { id: string; name: string; notes: string | null; actorId: string | null }[];
  breakdown: { id: string; category: string; name: string; notes: string | null }[];
  scenes: BackupScene[];
};

type Db = Prisma.TransactionClient;

// Borra lo que sale del guion (y solo eso). Lo comparten "reemplazar guion" y
// "restaurar copia" para que las dos hagan exactamente lo mismo.
export async function wipeScriptContent(db: Db, projectId: string) {
  await db.continuityCheck.deleteMany({ where: { projectId } });
  await db.scene.deleteMany({ where: { projectId } });
  await db.character.deleteMany({ where: { projectId } });
  await db.breakdownElement.deleteMany({ where: { projectId } });
}

// Guarda la copia. Devuelve null si el proyecto no tiene nada del guion (no
// hay nada que salvar). `keepId` evita podar la copia que se está restaurando.
export async function createScriptBackup(
  db: Db,
  projectId: string,
  reason: string,
  keepId?: string,
): Promise<string | null> {
  const [characters, breakdown, scenes] = await Promise.all([
    db.character.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    db.breakdownElement.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    db.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      include: {
        characters: { select: { characterId: true } },
        breakdownElements: { select: { breakdownElementId: true, condition: true } },
        crewMembers: { select: { crewMemberId: true } },
        shootingDayScenes: { select: { shootingDayId: true, callTime: true, order: true } },
        clapLogs: { select: { id: true } },
        shots: {
          orderBy: [{ order: "asc" }, { number: "asc" }],
          include: { storyboard: { orderBy: { order: "asc" } } },
        },
      },
    }),
  ]);

  if (scenes.length === 0 && characters.length === 0 && breakdown.length === 0) return null;

  const data: ScriptBackupData = {
    v: 1,
    characters: characters.map((c) => ({ id: c.id, name: c.name, notes: c.notes, actorId: c.actorId })),
    breakdown: breakdown.map((b) => ({ id: b.id, category: b.category, name: b.name, notes: b.notes })),
    scenes: scenes.map((s) => ({
      id: s.id,
      number: s.number,
      intExt: s.intExt,
      dayPart: s.dayPart,
      locationId: s.locationId,
      description: s.description,
      action: s.action,
      dialogueNotes: s.dialogueNotes,
      extrasNotes: s.extrasNotes,
      productionNotes: s.productionNotes,
      order: s.order,
      storyOrder: s.storyOrder,
      characterIds: s.characters.map((c) => c.characterId),
      breakdown: s.breakdownElements.map((b) => ({ id: b.breakdownElementId, condition: b.condition })),
      crewIds: s.crewMembers.map((c) => c.crewMemberId),
      days: s.shootingDayScenes.map((d) => ({ dayId: d.shootingDayId, callTime: d.callTime, order: d.order })),
      clapLogIds: s.clapLogs.map((c) => c.id),
      shots: s.shots.map((shot) => ({
        number: shot.number,
        shotType: shot.shotType,
        shotSize: shot.shotSize,
        angle: shot.angle,
        movement: shot.movement,
        camera: shot.camera,
        lens: shot.lens,
        fps: shot.fps,
        durationSec: shot.durationSec,
        description: shot.description,
        audio: shot.audio,
        notes: shot.notes,
        order: shot.order,
        shootingDayId: shot.shootingDayId,
        done: shot.done,
        frames: shot.storyboard.map((f) => ({ imageUrl: f.imageUrl, description: f.description, order: f.order })),
      })),
    })),
  };

  const created = await db.projectBackup.create({
    data: {
      projectId,
      reason,
      sceneCount: scenes.length,
      shotCount: scenes.reduce((n, s) => n + s.shots.length, 0),
      data: data as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  const old = await db.projectBackup.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    skip: BACKUPS_TO_KEEP,
    select: { id: true },
  });
  const drop = old.map((b) => b.id).filter((id) => id !== keepId);
  if (drop.length > 0) await db.projectBackup.deleteMany({ where: { id: { in: drop } } });

  return created.id;
}

export function listScriptBackups(projectId: string) {
  return prisma.projectBackup.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, reason: true, sceneCount: true, shotCount: true, createdAt: true },
  });
}

export type RestoreResult = { ok: true; scenes: number; shots: number } | { ok: false; error: string };

// Vuelve a poner el guion tal como estaba en la copia. Antes guarda otra copia
// de lo actual (así restaurar también se puede deshacer). Los vínculos con
// cosas que ya no existen (un actor, una localización, un día borrados) se
// dejan sin vínculo en vez de fallar.
export async function restoreScriptBackupCore(
  projectId: string,
  organizationId: string,
  backupId: string,
): Promise<RestoreResult> {
  const backup = await prisma.projectBackup.findFirst({ where: { id: backupId, projectId } });
  if (!backup) return { ok: false, error: "No se encontró esa copia." };
  const data = backup.data as unknown as ScriptBackupData;
  if (!data || data.v !== 1 || !Array.isArray(data.scenes)) {
    return { ok: false, error: "Esa copia no se puede leer." };
  }

  return prisma.$transaction(
    async (tx) => {
      await createScriptBackup(tx, projectId, "before-restore", backupId);
      await wipeScriptContent(tx, projectId);

      const [actors, locations, crew, days] = await Promise.all([
        tx.actor.findMany({ where: { projectId }, select: { id: true } }),
        tx.location.findMany({ where: { organizationId }, select: { id: true } }),
        tx.crewMember.findMany({ where: { projectId }, select: { id: true } }),
        tx.shootingDay.findMany({ where: { projectId }, select: { id: true } }),
      ]);
      const actorIds = new Set(actors.map((a) => a.id));
      const locationIds = new Set(locations.map((l) => l.id));
      const crewIds = new Set(crew.map((c) => c.id));
      const dayIds = new Set(days.map((d) => d.id));

      const characterId = new Map(data.characters.map((c) => [c.id, randomUUID()]));
      const breakdownId = new Map(data.breakdown.map((b) => [b.id, randomUUID()]));

      await tx.character.createMany({
        data: data.characters.map((c) => ({
          id: characterId.get(c.id)!,
          projectId,
          name: c.name,
          notes: c.notes,
          actorId: c.actorId && actorIds.has(c.actorId) ? c.actorId : null,
        })),
      });
      await tx.breakdownElement.createMany({
        data: data.breakdown.map((b) => ({
          id: breakdownId.get(b.id)!,
          projectId,
          category: b.category as never,
          name: b.name,
          notes: b.notes,
        })),
      });

      const sceneId = new Map(data.scenes.map((s) => [s.id, randomUUID()]));
      await tx.scene.createMany({
        data: data.scenes.map((s) => ({
          id: sceneId.get(s.id)!,
          projectId,
          number: s.number,
          intExt: s.intExt as never,
          dayPart: s.dayPart as never,
          locationId: s.locationId && locationIds.has(s.locationId) ? s.locationId : null,
          description: s.description,
          action: s.action,
          dialogueNotes: s.dialogueNotes,
          extrasNotes: s.extrasNotes,
          productionNotes: s.productionNotes,
          order: s.order,
          storyOrder: s.storyOrder,
        })),
      });

      const sceneCharacters: { sceneId: string; characterId: string }[] = [];
      const sceneBreakdown: { sceneId: string; breakdownElementId: string; condition: string | null }[] = [];
      const sceneCrew: { sceneId: string; crewMemberId: string }[] = [];
      const dayScenes: { shootingDayId: string; sceneId: string; callTime: string | null; order: number }[] = [];
      const shots: Prisma.ShotCreateManyInput[] = [];
      const frames: Prisma.StoryboardFrameCreateManyInput[] = [];

      for (const s of data.scenes) {
        const sid = sceneId.get(s.id)!;
        for (const id of s.characterIds) {
          const mapped = characterId.get(id);
          if (mapped) sceneCharacters.push({ sceneId: sid, characterId: mapped });
        }
        for (const b of s.breakdown) {
          const mapped = breakdownId.get(b.id);
          if (mapped) sceneBreakdown.push({ sceneId: sid, breakdownElementId: mapped, condition: b.condition });
        }
        for (const id of s.crewIds) if (crewIds.has(id)) sceneCrew.push({ sceneId: sid, crewMemberId: id });
        for (const d of s.days) {
          if (dayIds.has(d.dayId)) dayScenes.push({ shootingDayId: d.dayId, sceneId: sid, callTime: d.callTime, order: d.order });
        }
        for (const shot of s.shots) {
          const shotId = randomUUID();
          shots.push({
            id: shotId,
            sceneId: sid,
            number: shot.number,
            shotType: shot.shotType,
            shotSize: shot.shotSize,
            angle: shot.angle,
            movement: shot.movement,
            camera: shot.camera,
            lens: shot.lens,
            fps: shot.fps,
            durationSec: shot.durationSec,
            description: shot.description,
            audio: shot.audio,
            notes: shot.notes,
            order: shot.order,
            shootingDayId: shot.shootingDayId && dayIds.has(shot.shootingDayId) ? shot.shootingDayId : null,
            done: shot.done,
          });
          for (const f of shot.frames) {
            frames.push({ shotId, imageUrl: f.imageUrl, description: f.description, order: f.order });
          }
        }
      }

      if (sceneCharacters.length) await tx.sceneCharacter.createMany({ data: sceneCharacters });
      if (sceneBreakdown.length) await tx.sceneBreakdownElement.createMany({ data: sceneBreakdown });
      if (sceneCrew.length) await tx.sceneCrewMember.createMany({ data: sceneCrew });
      if (dayScenes.length) await tx.shootingDayScene.createMany({ data: dayScenes });
      if (shots.length) await tx.shot.createMany({ data: shots });
      if (frames.length) await tx.storyboardFrame.createMany({ data: frames });

      // Las tomas de la claqueta se conservaron al borrar (solo perdieron el
      // vínculo con la escena): se vuelven a enlazar a la escena restaurada.
      for (const s of data.scenes) {
        if (s.clapLogIds.length === 0) continue;
        await tx.clapLog.updateMany({
          where: { id: { in: s.clapLogIds }, projectId, sceneId: null },
          data: { sceneId: sceneId.get(s.id)! },
        });
      }

      return { ok: true as const, scenes: data.scenes.length, shots: shots.length };
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
}
