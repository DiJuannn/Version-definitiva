// Los momentos de la historia, en lenguaje llano.
//
// Es el vocabulario común de «Tu historia» (la barra de abajo del editor, el
// panel y el chequeo «¿Cómo va mi historia?»). Cada momento tiene un nombre que
// entiende quien nunca ha escrito un guion («Algo cambia») y, pequeño al lado,
// el término técnico («detonante») para que también lo aprenda.
//
// Los ids de los cinco momentos clave son los que ya guarda el mapa Yjs
// `beats` (BeatKey → sid de la escena): así los guiones que ya existen no se
// rompen. «Empieza» es nuevo y no se marca: es siempre la primera escena.
//
// Aquí solo hay datos y cálculos puros (sin React ni Yjs, salvo `setMoment`,
// que recibe los mapas): la barra, el panel y los tests usan lo mismo.

import type { BeatKey, SceneInfo } from "@/lib/screenplay/story";
import type { StoryMaps } from "@/lib/screenplay/story-doc";

// ------------------------------------------------------------------ vocabulario

export type MomentId = "start" | BeatKey;

export type Moment = {
  id: MomentId;
  plain: string; // nombre en la UI
  technical: string; // término de manual, pequeño al lado
  what: string; // qué es, en una frase
  question: string; // pregunta guía
  example: string; // en una película conocida
  at: number; // posición orientativa (0..1 de la duración)
  range: readonly [number, number]; // «suele pasar hacia el a–b %»
  auto?: boolean; // no se marca: lo da el guion (Empieza = escena 1)
};

export const MOMENTS: readonly Moment[] = [
  {
    id: "start",
    plain: "Empieza",
    technical: "planteamiento",
    what: "Cómo es el mundo de tu protagonista antes de que pase nada: quién es, dónde vive, qué le falta.",
    question: "¿Cómo es la vida de tu protagonista antes de que pase nada?",
    example: "En «Toy Story», Woody es el juguete favorito de Andy.",
    at: 0,
    range: [0, 5],
    auto: true,
  },
  {
    id: "inciting",
    plain: "Algo cambia",
    technical: "detonante",
    what: "Lo que rompe la vida normal de tu protagonista y pone la historia en marcha.",
    question: "¿Qué pasa que ya no deja a tu protagonista seguir como antes?",
    example: "En «Toy Story», llega Buzz.",
    at: 0.12,
    range: [10, 15],
  },
  {
    id: "turn1",
    plain: "No hay vuelta atrás",
    technical: "primer giro",
    what: "Tu protagonista se mete de lleno en el problema (o le meten). Aquí acaba el planteamiento.",
    question: "¿Qué decide (o qué le obliga) a meterse de lleno?",
    example: "En «El señor de los anillos», Frodo sale de la Comarca.",
    at: 0.25,
    range: [20, 30],
  },
  {
    id: "midpoint",
    plain: "Nada es lo que parecía",
    technical: "punto medio",
    what: "A mitad de camino algo cambia el sentido de lo que busca: una revelación o una falsa victoria.",
    question: "¿Qué descubre a mitad de camino que cambia lo que busca?",
    example: "En «El sexto sentido», Cole confiesa que ve muertos.",
    at: 0.5,
    range: [45, 55],
  },
  {
    id: "turn2",
    plain: "Todo se complica",
    technical: "segundo giro",
    what: "El peor momento: parece que todo está perdido, o aparece la pista que lleva al final.",
    question: "¿Cuál es su peor momento?",
    example: "En «Toy Story», Woody y Buzz acaban atrapados en casa de Sid.",
    at: 0.75,
    range: [70, 80],
  },
  {
    id: "climax",
    plain: "El gran final",
    technical: "clímax",
    what: "El enfrentamiento decisivo: se resuelve lo que estaba en juego.",
    question: "¿Cómo se enfrenta a lo que estaba en juego?",
    example: "En «Solo en casa», Kevin defiende la casa de los ladrones.",
    at: 0.9,
    range: [85, 95],
  },
] as const;

// Los cinco que se marcan («n de 5 momentos»).
export const KEY_MOMENTS: readonly Moment[] = MOMENTS.filter((m) => !m.auto);

export function momentById(id: string): Moment | undefined {
  return MOMENTS.find((m) => m.id === id);
}

export function isMomentId(v: unknown): v is MomentId {
  return typeof v === "string" && MOMENTS.some((m) => m.id === v);
}

// Los actos en lenguaje llano (en la página y el PDF se queda «ACTO I»).
export const ACT_PLAIN: Record<string, string> = {
  "Acto I": "Planteamiento",
  "Acto II": "Nudo",
  "Acto III": "Desenlace",
};

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ------------------------------------------------------------------ estructura elegida y duración prevista

export type StructureTemplate = "three" | "five" | "free";

// Los momentos son de la estructura en tres actos: con «5 actos» o «Libre»
// no se pintan.
export function structureTemplate(structure: Record<string, unknown>): StructureTemplate {
  const t = structure.template;
  return t === "five" || t === "free" ? t : "three";
}

// Cuánto suele durar cada formato (en páginas ≈ minutos).
export const FORMAT_TARGET_PAGES: Record<string, number> = {
  SHORT: 12,
  SERIES_EPISODE: 45,
  FEATURE: 95,
  OTHER: 20,
};

export const MAX_TARGET_PAGES = 240;

// La duración prevista: la que ha puesto el equipo (`structure.targetPages`)
// o, si no, la habitual del formato.
export function targetPages(structure: Record<string, unknown>, format: string | null | undefined): number {
  const own = Number(structure.targetPages);
  if (Number.isFinite(own) && own >= 1) return Math.min(MAX_TARGET_PAGES, Math.round(own));
  return FORMAT_TARGET_PAGES[format ?? ""] ?? FORMAT_TARGET_PAGES.OTHER;
}

// ------------------------------------------------------------------ la línea: escenas y lo que falta

// Un tramo de la línea, en proporción de la duración (0..1).
export type Span = { sid: string; a: number; b: number };

export type Timeline = {
  written: number; // octavos escritos
  total: number; // octavos de la línea: max(escrito, previsto)
  spans: Span[]; // una por escena, en orden
  todo: number; // octavos «por escribir» al final (0 si ya se llegó)
  byId: Map<string, Span>;
};

// Lo que mide cada escena en la línea: como mínimo un octavo (una escena
// recién empezada también se ve).
export const sceneUnits = (s: SceneInfo) => Math.max(1, s.eighths);

export function buildTimeline(scenes: SceneInfo[], target: number): Timeline {
  const written = scenes.reduce((n, s) => n + sceneUnits(s), 0);
  const total = Math.max(written, Math.round(target * 8), 1);
  const spans: Span[] = [];
  let acc = 0;
  for (const s of scenes) {
    const w = sceneUnits(s);
    spans.push({ sid: s.sid, a: acc / total, b: (acc + w) / total });
    acc += w;
  }
  return { written, total, spans, todo: total - written, byId: new Map(spans.map((s) => [s.sid, s])) };
}

// Dónde cae un momento marcado: el centro de SU escena. Es el mismo criterio
// en la barra y en el panel (antes la tira usaba el principio y el panel el
// centro).
export function spanCenter(s: Span): number {
  return (s.a + s.b) / 2;
}

// ------------------------------------------------------------------ momentos colocados

export type PlacedMoment = {
  moment: Moment;
  sid: string | null; // escena marcada (Empieza: la primera)
  scene: SceneInfo | null;
  at: number; // posición en la línea (0..1): su escena, o la orientativa si no está marcado
  placed: boolean;
};

export function placeMoments(scenes: SceneInfo[], beats: Record<string, string>, tl: Timeline): PlacedMoment[] {
  const byId = new Map(scenes.map((s) => [s.sid, s]));
  return MOMENTS.map((moment) => {
    const sid = moment.auto ? (scenes[0]?.sid ?? null) : (beats[moment.id] ?? null);
    const scene = sid ? (byId.get(sid) ?? null) : null;
    const span = scene ? tl.byId.get(scene.sid) : undefined;
    return {
      moment,
      sid: scene ? scene.sid : null,
      scene,
      at: span ? spanCenter(span) : moment.at,
      placed: Boolean(span),
    };
  });
}

// El momento en el que está la escena actual (el último marcado por detrás).
export function momentBehind(placed: PlacedMoment[], scenes: SceneInfo[], currentSid: string | null): PlacedMoment | null {
  const cur = scenes.findIndex((s) => s.sid === currentSid);
  if (cur === -1) return null;
  let best: PlacedMoment | null = null;
  let bestIndex = -1;
  for (const p of placed) {
    if (!p.placed || !p.scene) continue;
    const i = scenes.indexOf(p.scene);
    if (i <= cur && i >= bestIndex) {
      best = p;
      bestIndex = i;
    }
  }
  return best;
}

// ------------------------------------------------------------------ medidas en píxeles

// Bloques de la línea en píxeles: el ancho de cada escena es proporcional a lo
// que dura, con un mínimo para que se pueda tocar; si no caben todas con su
// mínimo y su separación, se funden en una línea continua.
export type BlockBox = { left: number; width: number };

export function layoutBlocks(units: number[], width: number, { gap = 2, min = 4 } = {}): { boxes: BlockBox[]; continuous: boolean } {
  const n = units.length;
  if (!n || width <= 0) return { boxes: units.map(() => ({ left: 0, width: 0 })), continuous: false };
  const continuous = n * (min + gap) - gap > width;
  const g = continuous ? 0 : gap;
  const m = continuous ? 0 : min;
  const avail = width - g * (n - 1);
  // Las que se quedarían por debajo del mínimo se fijan al mínimo y el resto
  // se reparte lo que queda (unas pocas vueltas bastan).
  const fixed = new Set<number>();
  let k = 0;
  for (let round = 0; round < 8; round++) {
    const free = units.reduce((s, u, i) => (fixed.has(i) ? s : s + u), 0);
    const room = avail - fixed.size * m;
    k = free > 0 ? room / free : 0;
    let changed = false;
    units.forEach((u, i) => {
      if (!fixed.has(i) && u * k < m) {
        fixed.add(i);
        changed = true;
      }
    });
    if (!changed) break;
  }
  const boxes: BlockBox[] = [];
  let x = 0;
  units.forEach((u, i) => {
    const w = fixed.has(i) ? m : u * k;
    boxes.push({ left: x, width: w });
    x += w + g;
  });
  return { boxes, continuous };
}

// Etiquetas que no se pisan: cada una se centra en su punto (sin salirse de la
// barra) y, si choca con otra, sube una fila. Solo entonces. Tampoco se ponen
// encima del palito de otra: el palito de una etiqueta de arriba cruza las
// filas de abajo hasta su escena, y ahí no puede haber ninguna etiqueta (si
// no, parecería que apunta a otra). Si hace falta, la etiqueta se corre hacia
// un lado, siempre que siga encima de su palito.
export type LabelBox = { x: number; w: number };
export type LabelPlace = { left: number; row: number };

export function assignRows(items: LabelBox[], width: number, { gap = 6, maxRows = 3, pad = 8 } = {}): LabelPlace[] {
  const n = items.length;
  const byX = [...items.keys()].sort((p, q) => items[p].x - items[q].x);

  // 1) Filas: la que choca con su vecina sube (como mucho maxRows). Se prueba
  //    de izquierda a derecha y al revés, y se queda la que menos sube.
  const initialRows = (order: number[]) => {
    const rows = new Array<number>(n).fill(0);
    const spans: { l: number; r: number }[][] = [];
    for (const i of order) {
      const it = items[i];
      const l = Math.max(0, Math.min(it.x - it.w / 2, width - it.w));
      const r = l + it.w;
      let row = spans.findIndex((list) => list.every((s) => r + gap <= s.l || l >= s.r + gap));
      if (row === -1) row = spans.length < maxRows ? spans.length : maxRows - 1;
      (spans[row] ??= []).push({ l, r });
      rows[i] = row;
    }
    return rows;
  };

  // 2) Posiciones: en cada fila, ninguna etiqueta tapa el palito de una de más
  //    arriba y cada una sigue encima del suyo.
  const place = (rows: number[], lenient: boolean): { lefts: number[]; bad: number } => {
    const lefts = new Array<number>(n).fill(0);
    for (let q = 0; q < maxRows; q++) {
      const forbidden = items.filter((_, i) => rows[i] > q).map((it) => it.x);
      let prevEnd = -Infinity;
      for (const i of byX.filter((i) => rows[i] === q)) {
        const { x, w } = items[i];
        // Dos momentos en la misma escena comparten palito: ese no estorba.
        const others = forbidden.filter((f) => Math.abs(f - x) > 3);
        const loGap = Math.max(0, ...others.filter((f) => f < x).map((f) => f + 3));
        const hiGap = Math.min(width, ...others.filter((f) => f > x).map((f) => f - 3));
        const m = Math.max(0, Math.min(pad, w / 2, x, width - x));
        const minL = Math.max(loGap, prevEnd + gap, x - w + m, 0);
        const maxL = Math.min(hiGap - w, x - m, width - w);
        if (minL > maxL + 0.5 && !lenient) return { lefts, bad: i };
        const left = Math.max(Math.min(x - w / 2, maxL), minL);
        lefts[i] = lenient ? Math.max(0, Math.min(left, width - w)) : left;
        prevEnd = lefts[i] + w;
      }
    }
    return { lefts, bad: -1 };
  };

  // Si una no cabe, sube una fila y se vuelve a colocar todo.
  const solve = (rows: number[]) => {
    for (let round = 0; round <= n * maxRows; round++) {
      const { lefts, bad } = place(rows, false);
      if (bad === -1) return { rows, lefts };
      if (rows[bad] >= maxRows - 1) return null;
      rows[bad]++;
    }
    return null;
  };

  const tries = [solve(initialRows(byX)), solve(initialRows([...byX].reverse()))].filter((t) => t !== null);
  const score = (rows: number[]) => Math.max(0, ...rows) * 100 + rows.reduce((a, b) => a + b, 0);
  const best = tries.sort((a, b) => score(a.rows) - score(b.rows))[0];
  if (best) return items.map((_, i) => ({ left: best.lefts[i], row: best.rows[i] }));
  // No cabe sin pisar nada (muy raro): lo mejor posible.
  const rows = initialRows(byX);
  const { lefts } = place(rows, true);
  return items.map((_, i) => ({ left: lefts[i], row: rows[i] }));
}

// ------------------------------------------------------------------ páginas

// Página (1..) en la que empieza una escena, contando por octavos.
export function scenePage(scenes: SceneInfo[], sid: string): number {
  let acc = 0;
  for (const s of scenes) {
    if (s.sid === sid) return Math.floor(acc / 8) + 1;
    acc += sceneUnits(s);
  }
  return 1;
}

export function pageAt(fraction: number, totalPages: number): number {
  return Math.max(1, Math.round(fraction * totalPages));
}

// «Suele pasar hacia el 10–15 % (≈ pág. 1–2 de 12).»
export function whenText(m: Moment, totalPages: number): string {
  const [a, b] = m.range;
  if (m.auto) return "Es la primera escena.";
  const pa = pageAt(a / 100, totalPages);
  const pb = pageAt(b / 100, totalPages);
  const pages = pa === pb ? `pág. ${pa}` : `pág. ${pa}–${pb}`;
  return `Suele pasar hacia el ${a}–${b} % (≈ ${pages} de ${totalPages}).`;
}

// ------------------------------------------------------------------ marcar un momento

// Marca (o quita) un momento en una escena. En tres actos, marcar un giro
// mueve también el comienzo del acto siguiente (el II empieza justo después
// del primer giro; el III, después del segundo).
export function setMoment(
  maps: Pick<StoryMaps, "beats" | "acts">,
  scenes: SceneInfo[],
  template: StructureTemplate,
  id: MomentId,
  sid: string | null,
) {
  if (id === "start") return;
  if (!sid) {
    maps.beats.delete(id);
    return;
  }
  maps.beats.set(id, sid);
  if (template !== "three") return;
  const nextAct = id === "turn1" ? "Acto II" : id === "turn2" ? "Acto III" : null;
  if (!nextAct) return;
  const i = scenes.findIndex((s) => s.sid === sid);
  const next = scenes[i + 1];
  for (const [k, v] of maps.acts.entries()) if (v === nextAct) maps.acts.delete(k);
  if (next) maps.acts.set(next.sid, nextAct);
}

// ------------------------------------------------------------------ ¿cómo va mi historia?

export type CheckItem =
  | { kind: "moment"; status: "ok" | "early" | "late" | "order" | "missing"; placed: PlacedMoment; page: number | null; expectedPage: number; after?: Moment }
  | { kind: "gap"; text: string; next: Moment | null; afterSid: string | null };

export type StoryCheck = {
  items: CheckItem[];
  done: number; // momentos clave marcados (de 5)
  writtenPages: number;
  targetPages: number;
  totalPages: number;
};

// Cuánto puede alejarse un momento de su sitio habitual antes de avisar.
export const DRIFT = 0.12;
// Un tramo sin momentos más largo que esto (proporción) es un hueco.
export const GAP = 0.25;
export const GAP_SLACK = 0.06;

export function checkStory({
  scenes,
  beats,
  target,
  dismissed = {},
}: {
  scenes: SceneInfo[];
  beats: Record<string, string>;
  target: number;
  dismissed?: Record<string, unknown>;
}): StoryCheck {
  const tl = buildTimeline(scenes, target);
  const totalPages = Math.max(1, Math.round(tl.total / 8));
  const writtenPages = Math.round((tl.written / 8) * 10) / 10;
  const placed = placeMoments(scenes, beats, tl).filter((p) => !p.moment.auto);
  const items: CheckItem[] = [];
  let lastPlaced: PlacedMoment | null = null;
  let gapAfterWritten = false;
  const writtenEnd = tl.written / tl.total;
  const lastScene = scenes[scenes.length - 1] ?? null;

  for (const p of placed) {
    const expectedPage = pageAt(p.moment.at, totalPages);
    if (!p.placed) {
      // Lo escrito se acaba antes de donde suele ir lo siguiente: un hueco.
      if (!gapAfterWritten && scenes.length > 0 && tl.todo > 0 && p.moment.at > writtenEnd) {
        gapAfterWritten = true;
        items.push({
          kind: "gap",
          text: `después de la escena ${lastScene!.number} no hay nada escrito. Lo siguiente suele ser «${p.moment.plain}»: ${lowerFirst(p.moment.question)}`,
          next: p.moment,
          afterSid: lastScene!.sid,
        });
      }
      items.push({ kind: "moment", status: "missing", placed: p, page: null, expectedPage });
      continue;
    }
    // Hueco entre dos momentos seguidos, los dos marcados: más separados de
    // lo que suelen estar (y de un cuarto de la historia como poco).
    if (lastPlaced && p.at - lastPlaced.at > Math.max(GAP, p.moment.at - lastPlaced.moment.at + GAP_SLACK)) {
      const pages = Math.round((p.at - lastPlaced.at) * totalPages);
      items.push({
        kind: "gap",
        text: `entre «${lastPlaced.moment.plain}» (esc. ${lastPlaced.scene!.number}) y «${p.moment.plain}» (esc. ${p.scene!.number}) hay unas ${pages} páginas sin ningún momento.`,
        next: null,
        afterSid: lastPlaced.sid,
      });
    }
    const page = scenePage(scenes, p.sid!);
    // «Está bien así» vale para la escena en la que se dijo; si se marca en
    // otra, se vuelve a mirar.
    const ok = dismissed[p.moment.id] === p.sid;
    let status: "ok" | "early" | "late" | "order" = "ok";
    if (lastPlaced && p.at < lastPlaced.at) status = "order";
    else if (!ok && p.at - p.moment.at > DRIFT) status = "late";
    else if (!ok && p.moment.at - p.at > DRIFT) status = "early";
    items.push({ kind: "moment", status, placed: p, page, expectedPage, ...(status === "order" && lastPlaced ? { after: lastPlaced.moment } : {}) });
    if (status !== "order") lastPlaced = p;
  }
  return { items, done: placed.filter((p) => p.placed).length, writtenPages, targetPages: target, totalPages };
}

function lowerFirst(s: string) {
  // «¿Cuál es…?» → «¿cuál es…?» dentro de una frase.
  return s.replace(/^(¿?)(\p{Lu})/u, (_m, q: string, c: string) => q + c.toLowerCase());
}

// Cuánto dura en pantalla (1 página ≈ 1 minuto): «≈8 s», «≈2 min».
export function screenTime(eighths: number): string {
  if (eighths <= 0) return "—";
  if (eighths < 8) return `≈${Math.round(eighths * 7.5)} s`;
  return `≈${Math.round(eighths / 8)} min`;
}

// ------------------------------------------------------------------ rodaje

export const isNightTime = (time: string) => /noche|night|atardecer|anochecer|dusk/i.test(time);

// Color de tira del plan de rodaje (interior/exterior · día/noche) a partir
// del encabezado. Mismos tokens que el plan de rodaje.
export function stripColorOf(scene: Pick<SceneInfo, "heading" | "time">): string {
  const prefix = scene.heading.trim().toUpperCase();
  const ext = /^(EXT|I\/E|INT\.?\/EXT|EXT\.?\/INT)/.test(prefix);
  const t = scene.time.toLowerCase();
  if (/atardecer|amanecer|anochecer|dusk|dawn|ocaso/.test(t)) return "var(--strip-twilight)";
  if (isNightTime(t)) return ext ? "var(--strip-ext-night)" : "var(--strip-int-night)";
  return ext ? "var(--strip-ext-day)" : "var(--strip-int-day)";
}
