// El día de rodaje en directo: dónde estamos frente al plan, a qué hora
// terminaremos a este ritmo y qué se cae del día (por horas de convenio o por
// luz). Sin base de datos ni React, para poder probarlo y recalcularlo en el
// cliente cada minuto.

import { DEFAULT_PREP_MIN, type DayTimeline, type TimedBlock } from "@/lib/schedule-plan";

// Un paso del día: un plano, o una escena entera (bloque sin lista de planos).
export type LiveUnit = {
  id: string; // id del plano o del bloque
  blockId: string;
  kind: "shot" | "scene";
  start: number;
  end: number;
  done: boolean;
  exteriorDay: boolean;
  characterIds: string[];
};

export type LiveDrop = { id: string; reason: "limit" | "light"; projectedEnd: number };
export type RestWarning = { characterId: string; restMinutes: number };

export type LiveForecast = {
  units: LiveUnit[];
  // null: no es el día (o aún no ha empezado) y se muestra el plan tal cual.
  now: number | null;
  started: boolean;
  finished: boolean;
  current: LiveUnit | null;
  // Hora del plan a la que corresponde lo ya rodado (el inicio de lo que toca).
  planMark: number;
  // Minutos de retraso (negativo: vamos adelantados).
  delay: number;
  projectedWrap: number;
  limit: number;
  sunset: number | null;
  drops: LiveDrop[];
  rest: RestWarning[];
};

export const REST_MIN_HOURS = 12;

function unitsOf(block: TimedBlock, now: number | null, delay: number): LiveUnit[] {
  if (block.kind === "SCENE" && block.scene) {
    const exteriorDay = block.scene.intExt !== "INT" && (block.scene.dayPart === "DAY" || block.scene.dayPart === "DAWN");
    // Una escena sin planos no se marca toma a toma: se da por rodada cuando
    // ha pasado su hora (con el retraso que llevemos).
    const done = now !== null && now >= block.end + delay;
    return [{ id: block.id, blockId: block.id, kind: "scene", start: block.start, end: block.end, done, exteriorDay, characterIds: block.scene.characterIds }];
  }
  return block.shots.map((s) => ({
    id: s.id,
    blockId: block.id,
    kind: "shot" as const,
    start: s.start,
    end: s.end,
    done: s.done,
    exteriorDay: s.intExt !== "INT" && (s.dayPart === "DAY" || s.dayPart === "DAWN"),
    characterIds: s.characterIds,
  }));
}

export function liveForecast(input: {
  timeline: DayTimeline;
  now: number | null; // minutos desde medianoche si hoy es el día; si no, null
  workdayHours: number;
  // La jornada siguiente si es al día siguiente: para el descanso del reparto.
  next?: { timeline: Pick<DayTimeline, "characterWindows"> } | null;
}): LiveForecast {
  const { timeline, workdayHours } = input;
  const started = input.now !== null && input.now >= timeline.firstStart;
  const now = started ? input.now : null;

  // Primera pasada sin retraso para saber qué toca; las escenas sin planos se
  // resuelven por hora, así que se repite con el retraso de los planos.
  let units = timeline.blocks.flatMap((b) => unitsOf(b, now, 0));
  let current = units.find((u) => !u.done) ?? null;
  let planMark = current ? current.start : timeline.wrap;
  let delay = now === null ? 0 : now - planMark;
  if (now !== null && units.some((u) => u.kind === "scene")) {
    units = timeline.blocks.flatMap((b) => unitsOf(b, now, Math.max(0, delay)));
    current = units.find((u) => !u.done) ?? null;
    planMark = current ? current.start : timeline.wrap;
    delay = now - planMark;
  }
  const finished = started && !current;

  const projectedWrap = finished ? Math.max(now ?? timeline.wrap, timeline.wrap + delay) : timeline.wrap + delay;
  const call = timeline.callTime ?? timeline.firstStart - DEFAULT_PREP_MIN;
  const limit = call + workdayHours * 60 + timeline.mealMinutes;

  const drops: LiveDrop[] = [];
  for (const u of units) {
    if (u.done) continue;
    const end = u.end + delay;
    if (end > limit) drops.push({ id: u.id, reason: "limit", projectedEnd: end });
    else if (u.exteriorDay && timeline.sunset !== null && end > timeline.sunset - 15) drops.push({ id: u.id, reason: "light", projectedEnd: end });
  }

  const rest: RestWarning[] = [];
  if (input.next) {
    const lastToday = new Map<string, number>();
    for (const u of units) for (const c of u.characterIds) lastToday.set(c, Math.max(lastToday.get(c) ?? 0, u.end + delay));
    for (const [c, w] of input.next.timeline.characterWindows) {
      const last = lastToday.get(c);
      if (last === undefined) continue;
      // Se cita al reparto media hora antes de su primer plano (vestuario, maquillaje).
      const restMinutes = 1440 - last + (w.first - 30);
      if (restMinutes < REST_MIN_HOURS * 60) rest.push({ characterId: c, restMinutes });
    }
    rest.sort((a, b) => a.restMinutes - b.restMinutes);
  }

  return { units, now, started, finished, current, planMark, delay, projectedWrap, limit, sunset: timeline.sunset, drops, rest };
}

// Minutos desde medianoche en Madrid si `date` es hoy en Madrid; si no, null.
export function madridNowOn(dateISO: string, at: Date = new Date()): number | null {
  const tz = "Europe/Madrid";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(dateISO));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);
  if (day !== today) return null;
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(at)
    .split(":")
    .map(Number);
  return h * 60 + m;
}
