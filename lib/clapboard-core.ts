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
    },
  });

  return { ok: true, id: created.id };
}
