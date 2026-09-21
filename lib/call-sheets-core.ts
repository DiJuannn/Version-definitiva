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
