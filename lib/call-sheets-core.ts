import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type CallSheetInput = {
  generalCallTime: string | null;
  transportNotes: string | null;
  cateringNotes: string | null;
  additionalNotes: string | null;
};

export async function upsertCallSheetCore(
  projectId: string,
  shootingDayId: string,
  data: CallSheetInput,
): Promise<boolean> {
  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId } });
  if (!day) return false;

  await prisma.callSheet.upsert({
    where: { shootingDayId },
    create: { shootingDayId, ...data },
    update: data,
  });
  return true;
}

// Hora de llamada orientativa según la luz de la primera escena del día.
const SUGGESTED_CALL_TIME: Record<string, string> = { DAWN: "05:30", DAY: "08:00", DUSK: "16:30", NIGHT: "19:00" };
const LIGHT_ORDER = ["DAWN", "DAY", "DUSK", "NIGHT"];

// Crea el call sheet de todos los días con escenas que aún no lo tienen, con una hora de llamada
// sugerida por la luz. Los que ya existen no se tocan. Devuelve cuántos se han creado.
export async function generateAllCallSheetsCore(projectId: string): Promise<number> {
  const days = await prisma.shootingDay.findMany({
    where: { projectId, callSheet: null, scenes: { some: {} } },
    select: { id: true, scenes: { select: { scene: { select: { dayPart: true } } } } },
  });
  for (const day of days) {
    const earliest = day.scenes
      .map((s) => s.scene.dayPart as string)
      .sort((a, b) => LIGHT_ORDER.indexOf(a) - LIGHT_ORDER.indexOf(b))[0];
    await upsertCallSheetCore(projectId, day.id, {
      generalCallTime: SUGGESTED_CALL_TIME[earliest] ?? null,
      transportNotes: null,
      cateringNotes: null,
      additionalNotes: null,
    });
  }
  return days.length;
}

// Enlace público de solo lectura al call sheet de un día. Activarlo crea un
// token largo e imposible de adivinar; desactivarlo lo borra y el enlace
// antiguo deja de funcionar. Volver a activar da un enlace distinto.
export async function setCallSheetSharingCore(
  projectId: string,
  shootingDayId: string,
  enabled: boolean,
): Promise<{ token: string | null } | null> {
  const day = await prisma.shootingDay.findFirst({
    where: { id: shootingDayId, projectId },
    select: { shareToken: true },
  });
  if (!day) return null;

  if (!enabled) {
    await prisma.shootingDay.update({ where: { id: shootingDayId }, data: { shareToken: null } });
    return { token: null };
  }
  if (day.shareToken) return { token: day.shareToken };

  const token = randomBytes(18).toString("base64url");
  await prisma.shootingDay.update({ where: { id: shootingDayId }, data: { shareToken: token } });
  return { token };
}

// Hora de una escena en un día concreto — ojo, escribe directo sobre la fila
// ShootingDayScene (no hace falta más: a diferencia del reparto, este campo
// no depende de ningún cálculo automático que se pueda pisar).
export async function updateSceneCallTimeCore(
  projectId: string,
  shootingDayId: string,
  assignmentId: string,
  callTime: string | null,
): Promise<boolean> {
  const assignment = await prisma.shootingDayScene.findFirst({
    where: { id: assignmentId, shootingDayId, shootingDay: { projectId } },
    select: { id: true },
  });
  if (!assignment) return false;

  await prisma.shootingDayScene.update({ where: { id: assignment.id }, data: { callTime } });
  return true;
}

// Corrección manual de qué personajes cita la hoja de llamada en una escena,
// para un día concreto — tiene prioridad sobre lo que sale solo (ver
// lib/shooting-day-summary.ts). characterIds vacío = "nadie", a propósito
// (para eso está la marca ShootingDaySceneCastOverride, que es lo que
// distingue "corregido a mano y vacío" de "sin corregir todavía").
export async function setSceneCastOverrideCore(
  projectId: string,
  shootingDayId: string,
  sceneId: string,
  characterIds: string[],
): Promise<boolean> {
  const [day, validCharacters] = await Promise.all([
    prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId }, select: { id: true } }),
    prisma.character.findMany({ where: { id: { in: characterIds }, projectId }, select: { id: true } }),
  ]);
  if (!day) return false;

  await prisma.$transaction(async (tx) => {
    await tx.shootingDaySceneCastOverride.upsert({
      where: { shootingDayId_sceneId: { shootingDayId, sceneId } },
      create: { shootingDayId, sceneId },
      update: {},
    });
    await tx.shootingDaySceneCharacter.deleteMany({ where: { shootingDayId, sceneId } });
    if (validCharacters.length > 0) {
      await tx.shootingDaySceneCharacter.createMany({
        data: validCharacters.map((c) => ({ shootingDayId, sceneId, characterId: c.id })),
      });
    }
  });
  return true;
}

export async function clearSceneCastOverrideCore(
  projectId: string,
  shootingDayId: string,
  sceneId: string,
): Promise<boolean> {
  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId }, select: { id: true } });
  if (!day) return false;

  await prisma.$transaction([
    prisma.shootingDaySceneCharacter.deleteMany({ where: { shootingDayId, sceneId } }),
    prisma.shootingDaySceneCastOverride.deleteMany({ where: { shootingDayId, sceneId } }),
  ]);
  return true;
}

// Corrección manual de qué equipo técnico cita la hoja de llamada ese día
// (a diferencia del reparto, el equipo se cita para todo el día, no por
// escena — la pantalla tampoco lo desglosa por escena).
export async function setCallSheetCrewCore(
  projectId: string,
  shootingDayId: string,
  crewMemberIds: string[],
): Promise<boolean> {
  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId }, select: { id: true } });
  if (!day) return false;

  const valid = await prisma.crewMember.findMany({
    where: { id: { in: crewMemberIds }, projectId },
    select: { id: true },
  });

  const callSheet = await prisma.callSheet.upsert({
    where: { shootingDayId },
    create: { shootingDayId, crewOverridden: true },
    update: { crewOverridden: true },
  });

  await prisma.callSheetCrewMember.deleteMany({ where: { callSheetId: callSheet.id } });
  if (valid.length > 0) {
    await prisma.callSheetCrewMember.createMany({
      data: valid.map((c) => ({ callSheetId: callSheet.id, crewMemberId: c.id })),
    });
  }
  return true;
}

export async function clearCallSheetCrewOverrideCore(
  projectId: string,
  shootingDayId: string,
): Promise<boolean> {
  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId }, select: { id: true } });
  if (!day) return false;

  const callSheet = await prisma.callSheet.findUnique({ where: { shootingDayId }, select: { id: true } });
  if (!callSheet) return true;

  await prisma.$transaction([
    prisma.callSheetCrewMember.deleteMany({ where: { callSheetId: callSheet.id } }),
    prisma.callSheet.update({ where: { id: callSheet.id }, data: { crewOverridden: false } }),
  ]);
  return true;
}
