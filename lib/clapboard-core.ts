import { prisma } from "@/lib/prisma";
import { DayPart, IntExt } from "@/lib/generated/prisma";

// Misma idea que optionalString (lib/form-utils.ts) pero para valores
// planos de JS en vez de FormDataEntryValue — la app manda JSON, no un
// FormData.
function normalize(value: string | null | undefined): string | null {
  const str = (value ?? "").trim();
  return str.length > 0 ? str : null;
}

export type LogClapInput = {
  sceneId?: string | null;
  sceneNumber: string;
  shotNumber?: string | null;
  take: number;
  director?: string | null;
  camera?: string | null;
  intExt?: string | null;
  dayPart?: string | null;
  // Parte de script: tomas metidas a mano (sin claqueta) o ya marcadas buenas.
  good?: boolean;
  notes?: string | null;
  createdAt?: Date | null;
};

export type LogClapResult = { ok: true; id: string } | { ok: false; error: string };

// Compartido entre logClap (Server Action de la web,
// lib/actions/clapboard.ts) y POST /api/mobile/projects/:id/claqueta/clap
// — la app manda JSON en vez de FormData, así que la conversión de tipos
// ya viene hecha antes de llegar aquí; esta función es la misma
// validación + creación para las dos superficies.
export async function logClapCore(projectId: string, input: LogClapInput): Promise<LogClapResult> {
  const sceneNumber = input.sceneNumber.trim();
  const take = Number(input.take);

  if (!sceneNumber || !Number.isFinite(take) || take < 1) {
    return { ok: false, error: "Falta el número de escena o la toma no es válida." };
  }

  const intExt = (Object.values(IntExt) as string[]).includes(input.intExt ?? "")
    ? (input.intExt as IntExt)
    : null;
  const dayPart = (Object.values(DayPart) as string[]).includes(input.dayPart ?? "")
    ? (input.dayPart as DayPart)
    : null;

  const created = await prisma.clapLog.create({
    data: {
      projectId,
      sceneId: normalize(input.sceneId) ?? undefined,
      sceneNumber,
      shotNumber: normalize(input.shotNumber),
      take,
      director: normalize(input.director),
      camera: normalize(input.camera),
      intExt,
      dayPart,
      good: input.good === true,
      notes: normalize(input.notes),
      ...(input.createdAt && !Number.isNaN(input.createdAt.getTime()) ? { createdAt: input.createdAt } : {}),
    },
  });

  if (created.good) await syncShotDone(projectId, created.sceneId, created.sceneNumber, created.shotNumber);

  return { ok: true, id: created.id };
}

// Un plano con alguna toma buena está rodado; sin ninguna, deja de estarlo. Se
// llama solo cuando cambia algo que afecta a "buena" (marcar/desmarcar, borrar,
// cambiar de plano), no al editar una nota.
export async function syncShotDone(
  projectId: string,
  sceneId: string | null,
  sceneNumber: string,
  shotNumber: string | null,
) {
  const shotNo = normalize(shotNumber);
  if (!shotNo) return;

  const scene = sceneId
    ? await prisma.scene.findFirst({ where: { id: sceneId, projectId }, select: { id: true } })
    : await prisma.scene.findFirst({ where: { projectId, number: sceneNumber }, select: { id: true } });
  if (!scene) return;

  const shots = await prisma.shot.findMany({ where: { sceneId: scene.id }, select: { id: true, number: true } });
  const shot = shots.find((sh) => sh.number.trim().toLowerCase() === shotNo.toLowerCase());
  if (!shot) return;

  const goodTakes = await prisma.clapLog.findMany({
    where: { projectId, good: true, OR: [{ sceneId: scene.id }, { sceneId: null, sceneNumber }] },
    select: { shotNumber: true },
  });
  const hasGood = goodTakes.some((t) => (t.shotNumber ?? "").trim().toLowerCase() === shotNo.toLowerCase());
  await prisma.shot.update({ where: { id: shot.id }, data: { done: hasGood } });
}

export type ManualTakeInput = {
  sceneNumber: string;
  shotNumber?: string | null;
  take: number;
  good?: boolean;
  notes?: string | null;
  // AAAA-MM-DD; sin fecha (o si es hoy), la hora real de ahora.
  date?: string | null;
};

// Una toma apuntada a mano en la pantalla Script, sin haber usado la claqueta.
export async function addManualTakeCore(projectId: string, input: ManualTakeInput): Promise<LogClapResult> {
  const scene = await prisma.scene.findFirst({
    where: { projectId, number: input.sceneNumber.trim() },
    select: { id: true, intExt: true, dayPart: true },
  });

  let createdAt: Date | null = null;
  if (input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
    // Otro día se apunta a mediodía para que no cambie de fecha por la zona horaria.
    createdAt = input.date === today ? null : new Date(`${input.date}T12:00:00Z`);
  }

  return logClapCore(projectId, {
    sceneId: scene?.id ?? null,
    sceneNumber: input.sceneNumber,
    shotNumber: input.shotNumber ?? null,
    take: input.take,
    intExt: scene?.intExt ?? null,
    dayPart: scene?.dayPart ?? null,
    good: input.good === true,
    notes: input.notes ?? null,
    createdAt,
  });
}

export type UpdateClapLogInput = {
  good?: boolean;
  notes?: string | null;
  take?: number;
  shotNumber?: string | null;
  sceneNumber?: string;
};

export async function updateClapLogCore(
  projectId: string,
  clapLogId: string,
  input: UpdateClapLogInput,
): Promise<boolean> {
  const before = await prisma.clapLog.findFirst({ where: { id: clapLogId, projectId } });
  if (!before) return false;

  const data: {
    good?: boolean;
    notes?: string | null;
    take?: number;
    shotNumber?: string | null;
    sceneNumber?: string;
    sceneId?: string | null;
  } = {};
  if (typeof input.good === "boolean") data.good = input.good;
  if (input.notes !== undefined) data.notes = normalize(input.notes);
  if (input.take !== undefined) {
    const take = Number(input.take);
    if (!Number.isFinite(take) || take < 1) return false;
    data.take = Math.floor(take);
  }
  if (input.shotNumber !== undefined) data.shotNumber = normalize(input.shotNumber);
  if (input.sceneNumber !== undefined) {
    const sceneNumber = input.sceneNumber.trim();
    if (!sceneNumber) return false;
    data.sceneNumber = sceneNumber;
    // Al cambiar de escena, el vínculo se recalcula por número.
    const scene = await prisma.scene.findFirst({ where: { projectId, number: sceneNumber }, select: { id: true } });
    data.sceneId = scene?.id ?? null;
  }

  const after = await prisma.clapLog.update({ where: { id: clapLogId }, data });

  const shotChanged =
    after.shotNumber !== before.shotNumber || after.sceneNumber !== before.sceneNumber || after.good !== before.good;
  if (shotChanged) {
    await syncShotDone(projectId, after.sceneId, after.sceneNumber, after.shotNumber);
    if (after.shotNumber !== before.shotNumber || after.sceneNumber !== before.sceneNumber) {
      await syncShotDone(projectId, before.sceneId, before.sceneNumber, before.shotNumber);
    }
  }
  return true;
}

export async function deleteClapLogCore(projectId: string, clapLogId: string) {
  const before = await prisma.clapLog.findFirst({ where: { id: clapLogId, projectId } });
  if (!before) return;
  await prisma.clapLog.delete({ where: { id: clapLogId } });
  if (before.good) await syncShotDone(projectId, before.sceneId, before.sceneNumber, before.shotNumber);
}
