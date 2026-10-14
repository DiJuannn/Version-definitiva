// Cálculo del orden de rodaje de una jornada: horas de cada bloque y plano,
// fin de jornada, citación de cada personaje y avisos. Sin base de datos ni
// React: lo usan el servidor (hoja de llamada, móvil) y el editor del cliente
// (para recalcular al instante mientras se arrastra).

import type { DayPart, IntExt, ScheduleBlockKind } from "@/lib/generated/prisma";

export const DEFAULT_PREP_MIN = 45;
const DEFAULT_SHOT_MIN = 25;

// Minutos de rodaje por tamaño de plano (incluye ensayo, luz y tomas). Es una
// estimación de partida: cada plano puede llevar la suya.
const SIZE_MIN: Record<string, number> = {
  PGG: 45, GPG: 45, PG: 35, PE: 30, PA: 30, PML: 25, PM: 25, PMC: 20,
  PP: 20, GPP: 15, PPP: 15, PD: 10, PDET: 10, INS: 10, INSERT: 10,
};
const MOVEMENT_EXTRA: [RegExp, number][] = [
  [/gr[uú]a|jib/i, 40],
  [/dron|drone/i, 30],
  [/steadicam|gimbal|estabilizador/i, 20],
  [/travel+ing|dolly|carro/i, 15],
];

export function estimateShotMinutes(shot: { shotSize: string | null; movement: string | null; estimatedMin?: number | null }) {
  if (shot.estimatedMin && shot.estimatedMin > 0) return shot.estimatedMin;
  const size = shot.shotSize?.trim().toUpperCase().replace(/\.$/, "") ?? "";
  let min = SIZE_MIN[size] ?? DEFAULT_SHOT_MIN;
  for (const [re, extra] of MOVEMENT_EXTRA) if (shot.movement && re.test(shot.movement)) min += extra;
  return min;
}

export function parseHHMM(value: string | null | undefined): number | null {
  const m = value?.trim().match(/^(\d{1,2})[:.h](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 29 || min > 59) return null;
  return h * 60 + min;
}

export function formatHHMM(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

// Puesta de sol (minutos desde medianoche, hora de Madrid) para una fecha y
// coordenadas — algoritmo de la NOAA, precisión de un par de minutos, de
// sobra para avisar de "esto es de noche y aún hay luz".
export function sunsetMinutes(date: Date, lat = 40.4168, lng = -3.7038): number | null {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH < -1 || cosH > 1) return null;
  const ha = Math.acos(cosH) / rad;
  const utcMinutes = 720 - 4 * (lng - ha) - eqTime;
  // Hora de Madrid: +2 en horario de verano (último domingo de marzo a último de octubre), +1 el resto.
  const y = date.getUTCFullYear();
  const lastSunday = (month: number) => {
    const d = new Date(Date.UTC(y, month + 1, 0));
    return Date.UTC(y, month, d.getUTCDate() - d.getUTCDay());
  };
  const t = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
  const offset = t >= lastSunday(2) && t < lastSunday(9) ? 120 : 60;
  return utcMinutes + offset;
}

export type PlanShot = {
  id: string;
  sceneId: string;
  sceneNumber: string;
  number: string;
  shotSize: string | null;
  movement: string | null;
  description: string | null;
  estimatedMin: number | null;
  intExt: IntExt;
  dayPart: DayPart;
  characterIds: string[];
  done: boolean;
};

export type PlanBlock = {
  id: string;
  kind: ScheduleBlockKind;
  title: string | null;
  durationMin: number | null;
  startTime: string | null;
  notes: string | null;
  // Bloque SCENE: la escena (sin lista de planos) que se rueda entera.
  scene: { id: string; number: string; intExt: IntExt; dayPart: DayPart; characterIds: string[]; durationMin: number | null } | null;
  shots: PlanShot[];
};

export type TimedShot = PlanShot & { start: number; end: number; minutes: number };
export type TimedBlock = Omit<PlanBlock, "shots"> & { start: number; end: number; minutes: number; shots: TimedShot[]; waitBefore: number };

export type PlanWarning = {
  id: string;
  tone: "warn" | "danger";
  text: string;
  detail?: string;
  blockId?: string;
};

const SCENE_BLOCK_DEFAULT_MIN = 90;
const MEAL_DEFAULT_MIN = 60;
const MOVE_DEFAULT_MIN = 30;

export function blockMinutes(block: PlanBlock): number {
  if (block.kind === "SHOTS") {
    if (block.durationMin && block.durationMin > 0) return block.durationMin;
    return block.shots.reduce((n, s) => n + estimateShotMinutes(s), 0);
  }
  if (block.durationMin && block.durationMin > 0) return block.durationMin;
  if (block.kind === "SCENE") return block.scene?.durationMin ?? SCENE_BLOCK_DEFAULT_MIN;
  if (block.kind === "MEAL") return MEAL_DEFAULT_MIN;
  if (block.kind === "MOVE") return MOVE_DEFAULT_MIN;
  return 0;
}

export type DayTimeline = {
  callTime: number | null;
  firstStart: number;
  wrap: number;
  blocks: TimedBlock[];
  workMinutes: number;
  mealMinutes: number;
  sunset: number | null;
  // Primer y último momento en que hace falta cada personaje (para citarlo).
  characterWindows: Map<string, { first: number; last: number }>;
};

// Horas de toda la jornada. Sin hora de llamada se calcula igual desde las
// 08:00 para tener duraciones, pero el aviso pide ponerla.
export function computeDayTimeline(input: {
  date: Date;
  callTime: string | null;
  prepMin: number | null;
  blocks: PlanBlock[];
  lat?: number | null;
  lng?: number | null;
}): DayTimeline {
  const callTime = parseHHMM(input.callTime);
  const prep = input.prepMin ?? DEFAULT_PREP_MIN;
  const firstStart = (callTime ?? 8 * 60) + prep;
  let cursor = firstStart;
  let mealMinutes = 0;
  const windows = new Map<string, { first: number; last: number }>();
  const blocks: TimedBlock[] = [];

  for (const block of input.blocks) {
    const fixed = parseHHMM(block.startTime);
    const start = fixed !== null && fixed > cursor ? fixed : cursor;
    const waitBefore = start - cursor;
    const minutes = blockMinutes(block);
    let shotCursor = start;
    const shots: TimedShot[] = block.shots.map((shot) => {
      const m = block.durationMin && block.kind === "SHOTS" && block.shots.length > 0
        ? Math.round(block.durationMin / block.shots.length)
        : estimateShotMinutes(shot);
      const timed = { ...shot, start: shotCursor, end: shotCursor + m, minutes: m };
      shotCursor += m;
      for (const c of shot.characterIds) {
        const w = windows.get(c);
        windows.set(c, { first: Math.min(w?.first ?? Infinity, timed.start), last: Math.max(w?.last ?? 0, timed.end) });
      }
      return timed;
    });
    if (block.kind === "SCENE" && block.scene) {
      for (const c of block.scene.characterIds) {
        const w = windows.get(c);
        windows.set(c, { first: Math.min(w?.first ?? Infinity, start), last: Math.max(w?.last ?? 0, start + minutes) });
      }
    }
    if (block.kind === "MEAL") mealMinutes += minutes;
    blocks.push({ ...block, start, end: start + minutes, minutes, shots, waitBefore });
    cursor = start + minutes;
  }

  const sunset = sunsetMinutes(input.date, input.lat ?? undefined, input.lng ?? undefined);
  return {
    callTime,
    firstStart,
    wrap: cursor,
    blocks,
    workMinutes: cursor - (callTime ?? firstStart - prep) - mealMinutes,
    mealMinutes,
    sunset,
    characterWindows: windows,
  };
}

function isNight(intExt: IntExt, dayPart: DayPart) {
  return intExt !== "INT" && (dayPart === "NIGHT" || dayPart === "DUSK");
}
function isDaylight(intExt: IntExt, dayPart: DayPart) {
  return intExt !== "INT" && (dayPart === "DAY" || dayPart === "DAWN");
}

// Avisos de una jornada a partir de su línea de tiempo.
export function dayWarnings(timeline: DayTimeline, opts: { workdayHours: number; hasShots: boolean }): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  if (!opts.hasShots) return warnings;
  if (timeline.callTime === null) {
    warnings.push({ id: "no-call", tone: "warn", text: "Falta la hora de llamada", detail: "Sin ella, las horas del orden de rodaje son orientativas (se calcula desde las 08:00)." });
  }
  const max = opts.workdayHours * 60;
  if (timeline.workMinutes > max) {
    const waits = timeline.blocks.reduce((n, b) => n + b.waitBefore, 0);
    warnings.push({
      id: "long",
      tone: timeline.workMinutes > max + 120 ? "danger" : "warn",
      text: `Jornada de ${formatDuration(timeline.workMinutes)}: pasa de ${opts.workdayHours} h de trabajo`,
      detail: waits > 0 ? `Incluye ${formatDuration(waits)} de espera entre bloques.` : "Mueve algún bloque a otra jornada o ajusta las estimaciones.",
    });
  }
  if (timeline.sunset !== null) {
    for (const block of timeline.blocks) {
      const parts: { intExt: IntExt; dayPart: DayPart; start: number; end: number }[] =
        block.kind === "SCENE" && block.scene ? [{ ...block.scene, start: block.start, end: block.end }] : block.shots;
      const night = parts.filter((p) => isNight(p.intExt, p.dayPart));
      const day = parts.filter((p) => isDaylight(p.intExt, p.dayPart));
      if (night.length > 0 && Math.min(...night.map((p) => p.start)) < timeline.sunset + 20) {
        warnings.push({
          id: `night-${block.id}`,
          tone: "warn",
          blockId: block.id,
          text: `Exterior de noche a las ${formatHHMM(Math.min(...night.map((p) => p.start)))}: aún hay luz`,
          detail: `El sol se pone a las ${formatHHMM(timeline.sunset)}; para exterior noche, a partir de las ${formatHHMM(timeline.sunset + 30)}.`,
        });
      }
      if (day.length > 0 && Math.max(...day.map((p) => p.end)) > timeline.sunset - 15) {
        warnings.push({
          id: `light-${block.id}`,
          tone: "danger",
          blockId: block.id,
          text: `Exterior de día hasta las ${formatHHMM(Math.max(...day.map((p) => p.end)))}: se va la luz`,
          detail: `El sol se pone a las ${formatHHMM(timeline.sunset)}.`,
        });
      }
    }
  }
  return warnings;
}
