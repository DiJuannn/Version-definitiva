// Maquetación del guion en páginas con el formato estándar de la industria.
//
// Courier 12 es monoespaciada: cada carácter mide exactamente 0,1" y cada
// línea 1/6". Por eso se puede paginar contando caracteres y líneas, sin
// medir texto — el PDF dibuja estas mismas líneas en estas mismas posiciones,
// y el contador de páginas del editor usa esta misma función: lo que dice el
// editor es lo que sale impreso.

import { UNTITLED_HEADING, characterName, sceneNumbering, type BlockType, type ScreenplayBlock } from "@/lib/screenplay/blocks";

export type PageSize = "A4" | "LETTER";

export const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string }> = {
  A4: { width: 8.27, height: 11.69, label: "A4" },
  LETTER: { width: 8.5, height: 11, label: "Carta (EE. UU.)" },
};

export const CHAR_WIDTH = 0.1; // pulgadas por carácter en Courier 12
export const LINE_HEIGHT = 1 / 6; // pulgadas por línea
export const MARGIN = { top: 1, bottom: 1, left: 1.5, right: 1 };

// Sangría (desde el margen izquierdo) y ancho en caracteres de cada bloque.
const FORMAT: Record<BlockType, { indent: number; width: number; before: number; upper?: boolean }> = {
  sceneHeading: { indent: 0, width: 60, before: 2, upper: true },
  action: { indent: 0, width: 60, before: 1 },
  character: { indent: 2.2, width: 38, before: 1, upper: true },
  parenthetical: { indent: 1.6, width: 26, before: 0 },
  dialogue: { indent: 1.0, width: 35, before: 0 },
  transition: { indent: 0, width: 60, before: 1, upper: true },
  shot: { indent: 0, width: 60, before: 1, upper: true },
  note: { indent: 0, width: 60, before: 0 },
};

export const MORE = "(MÁS)";
export const CONTINUED = "(CONT.)";

export type LayoutLine = {
  text: string;
  x: number; // pulgadas desde el borde izquierdo de la página
  kind: BlockType | "more" | "contd" | "blank";
  sceneNumber?: string;
  block?: number; // índice del bloque de origen (marcas de página del editor)
};

export type LayoutPage = { number: number; lines: LayoutLine[] };

export function linesPerPage(size: PageSize): number {
  return Math.floor((PAGE_SIZES[size].height - MARGIN.top - MARGIN.bottom) / LINE_HEIGHT);
}

// Parte el texto en líneas de como mucho `width` caracteres, por palabras.
export function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      out.push("");
      continue;
    }
    let line = "";
    for (let word of words) {
      while (word.length > width) {
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

type Chunk = {
  index: number;
  type: BlockType;
  lines: string[];
  before: number;
  sceneNumber?: string;
};

// Un "grupo" no se separa al cambiar de página salvo por las reglas de abajo:
// encabezado + lo que le sigue, y personaje + su diálogo.
type Group = { kind: "plain" | "dialogue" | "heading"; chunks: Chunk[]; speaker?: string };

function toChunks(blocks: ScreenplayBlock[], sceneNumbers: boolean): Chunk[] {
  const numbers = sceneNumbering(blocks);
  const chunks: Chunk[] = [];
  for (const [index, b] of blocks.entries()) {
    if (b.type === "note") continue; // las notas no se imprimen
    const f = FORMAT[b.type];
    const number = b.type === "sceneHeading" ? numbers.get(index) : undefined;
    let text = b.text.trim();
    // Escena sin encabezado pero con texto: se imprime un encabezado de
    // relleno para que la numeración sea la misma que en el editor.
    if (!text && number !== undefined) text = UNTITLED_HEADING;
    if (!text) continue;
    if (f.upper) text = text.toUpperCase();
    if (b.type === "parenthetical" && !text.startsWith("(")) text = `(${text})`;
    const chunk: Chunk = { index, type: b.type, lines: wrap(text, f.width), before: f.before };
    if (number !== undefined && sceneNumbers) chunk.sceneNumber = String(number);
    chunks.push(chunk);
  }
  if (chunks[0]) chunks[0].before = 0;
  return chunks;
}

function toGroups(chunks: Chunk[]): Group[] {
  const groups: Group[] = [];
  for (const c of chunks) {
    const last = groups[groups.length - 1];
    if ((c.type === "dialogue" || c.type === "parenthetical") && last?.kind === "dialogue") {
      last.chunks.push(c);
    } else if (c.type === "character") {
      groups.push({ kind: "dialogue", chunks: [c], speaker: characterName(c.lines.join(" ")) });
    } else if (c.type === "sceneHeading") {
      groups.push({ kind: "heading", chunks: [c] });
    } else {
      groups.push({ kind: "plain", chunks: [c] });
    }
  }
  return groups;
}

function lineX(type: BlockType, text: string, pageWidth: number): number {
  if (type === "transition") return pageWidth - MARGIN.right - text.length * CHAR_WIDTH;
  return MARGIN.left + FORMAT[type].indent;
}

// La misma lista de bloques se maqueta varias veces seguidas (marcas de
// página, escenas, contadores): se recuerda el último resultado por lista.
// Las páginas que devuelve no se deben modificar.
const layoutMemo = new WeakMap<readonly ScreenplayBlock[], Map<string, LayoutPage[]>>();

export function layoutScreenplay(
  blocks: ScreenplayBlock[],
  opts: { size?: PageSize; sceneNumbers?: boolean } = {},
): LayoutPage[] {
  const key = `${opts.size ?? "A4"}:${opts.sceneNumbers ?? true}`;
  let byOpts = layoutMemo.get(blocks);
  const hit = byOpts?.get(key);
  if (hit) return hit;
  const pages = layoutUncached(blocks, opts);
  if (!byOpts) layoutMemo.set(blocks, (byOpts = new Map()));
  byOpts.set(key, pages);
  return pages;
}

function layoutUncached(blocks: ScreenplayBlock[], opts: { size?: PageSize; sceneNumbers?: boolean }): LayoutPage[] {
  const size = opts.size ?? "A4";
  const pageWidth = PAGE_SIZES[size].width;
  const capacity = linesPerPage(size);
  const groups = toGroups(toChunks(blocks, opts.sceneNumbers ?? true));

  const pages: LayoutPage[] = [];
  let lines: LayoutLine[] = [];
  const newPage = () => {
    pages.push({ number: pages.length + 1, lines });
    lines = [];
  };
  const free = () => capacity - lines.length;
  const emit = (type: BlockType, text: string, block: number, sceneNumber?: string) =>
    lines.push({ text, x: lineX(type, text, pageWidth), kind: type, sceneNumber, block });
  const blanks = (n: number) => {
    if (!lines.length) return; // nunca líneas en blanco arriba del todo
    for (let i = 0; i < n; i++) lines.push({ text: "", x: 0, kind: "blank" });
  };

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const first = g.chunks[0];
    const height = g.chunks.reduce((n, c, i) => n + c.lines.length + (i === 0 ? 0 : c.before), 0);

    if (g.kind === "heading") {
      // Un encabezado nunca se queda solo al pie: necesita al menos 2 líneas
      // de lo que viene detrás en la misma página.
      const next = groups[gi + 1];
      const nextFirst = next?.chunks[0];
      const need = first.before + first.lines.length + (nextFirst ? nextFirst.before + Math.min(2, nextFirst.lines.length) : 0);
      if (lines.length && free() < need) newPage();
      blanks(first.before);
      first.lines.forEach((l, i) => emit("sceneHeading", l, first.index, i === 0 ? first.sceneNumber : undefined));
      continue;
    }

    if (g.kind === "plain") {
      const c = first;
      if (lines.length && free() >= c.before + c.lines.length) {
        blanks(c.before);
        c.lines.forEach((l) => emit(c.type, l, c.index));
        continue;
      }
      // Acción larga: se parte si quedan al menos 2 líneas a cada lado.
      const room = free() - c.before;
      if (c.type === "action" && lines.length && room >= 2 && c.lines.length - room >= 2) {
        blanks(c.before);
        c.lines.slice(0, room).forEach((l) => emit(c.type, l, c.index));
        newPage();
        c.lines.slice(room).forEach((l) => emit(c.type, l, c.index));
        continue;
      }
      if (lines.length) newPage();
      blanks(c.before);
      c.lines.forEach((l) => emit(c.type, l, c.index));
      continue;
    }

    // Diálogo: entero si cabe.
    if (!lines.length || free() >= first.before + height) {
      blanks(first.before);
      for (const c of g.chunks) c.lines.forEach((l) => emit(c.type, l, c.index));
      continue;
    }

    // No cabe: se parte por líneas de diálogo, con (MÁS) al pie y
    // "PERSONAJE (CONT.)" arriba de la página siguiente. Mínimo 2 líneas de
    // diálogo antes del corte y 1 después; si no, todo a la página siguiente.
    const flat: { type: BlockType; text: string; index: number }[] = [];
    g.chunks.forEach((c) => c.lines.forEach((l) => flat.push({ type: c.type, text: l, index: c.index })));
    const roomForBody = free() - first.before - 1; // -1 por la línea (MÁS)
    const body = flat.slice(first.lines.length);
    let cut = Math.min(body.length - 1, roomForBody - first.lines.length);
    // No cortar justo después de una acotación.
    while (cut > 0 && body[cut - 1].type === "parenthetical") cut -= 1;
    const dialogueBefore = body.slice(0, cut).filter((l) => l.type === "dialogue").length;

    if (cut < 2 || dialogueBefore < 2) {
      newPage();
      for (const c of g.chunks) c.lines.forEach((l) => emit(c.type, l, c.index));
      continue;
    }

    blanks(first.before);
    first.lines.forEach((l) => emit("character", l, first.index));
    body.slice(0, cut).forEach((l) => emit(l.type, l.text, l.index));
    lines.push({ text: MORE, x: MARGIN.left + FORMAT.character.indent, kind: "more" });
    newPage();
    const contd = `${g.speaker ?? first.lines[0]} ${CONTINUED}`;
    lines.push({ text: contd, x: MARGIN.left + FORMAT.character.indent, kind: "contd" });
    let rest = body.slice(cut);
    while (rest.length) {
      const fit = free();
      rest.slice(0, fit).forEach((l) => emit(l.type, l.text, l.index));
      rest = rest.slice(fit);
      if (rest.length) newPage();
    }
  }

  if (lines.length || !pages.length) newPage();
  return pages;
}

// Bloque en el que empieza cada página (marcas de página del editor).
export function pageStarts(pages: LayoutPage[]): { block: number; page: number }[] {
  const out: { block: number; page: number }[] = [];
  for (const p of pages) {
    const first = p.lines.find((l) => l.block !== undefined);
    if (first?.block !== undefined) out.push({ block: first.block, page: p.number });
  }
  return out;
}

// ------------------------------------------------------------ duración

// La medida del guion, una sola para toda la UI (barra, Radiografía, menú de
// exportar, lista de guiones): sale de la maquetación real, la misma que el PDF.
export type ScriptLength = {
  printedPages: number; // páginas del PDF, sin la portada
  eighths: number; // largo en octavos de página (como en producción)
  minutes: number; // ≈ 1 página por minuto, redondeado
  seconds: number; // lo mismo en segundos (para «10 min 45 s»)
  pagesLabel: string; // «10 6/8 págs.» · «1 pág.» · «Sin páginas»
  minutesLabel: string; // «≈ 11 min» · «< 1 min»
  label: string; // «10 6/8 págs. · ≈ 11 min»
};

export function scriptLength(blocks: ScreenplayBlock[], size: PageSize = "A4"): ScriptLength {
  const hasText = blocks.some((b) => b.type !== "note" && b.text.trim());
  if (!hasText) {
    return { printedPages: 0, eighths: 0, minutes: 0, seconds: 0, pagesLabel: "Sin páginas", minutesLabel: "0 min", label: "Sin páginas" };
  }
  const pages = layoutScreenplay(blocks, { size });
  const perPage = linesPerPage(size);
  const lines = (pages.length - 1) * perPage + pages[pages.length - 1].lines.length;
  const eighths = Math.max(1, Math.round((lines / perPage) * 8));
  const seconds = Math.round((lines / perPage) * 60);
  const minutes = Math.round(seconds / 60);
  const pagesLabel = `${formatPagesEighths(eighths)} ${eighths <= 8 ? "pág." : "págs."}`;
  const minutesLabel = minutes < 1 ? "< 1 min" : `≈ ${minutes} min`;
  return { printedPages: pages.length, eighths, minutes, seconds, pagesLabel, minutesLabel, label: `${pagesLabel} · ${minutesLabel}` };
}

// 0 → «0», 6 → «6/8», 86 → «10 6/8» (el formato de los octavos de producción).
export function formatPagesEighths(eighths: number): string {
  const whole = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (!whole) return rest ? `${rest}/8` : "0";
  return rest ? `${whole} ${rest}/8` : `${whole}`;
}

// «10 min 45 s», «45 s», «2 min».
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

// Estadísticas rápidas que se guardan junto al guion (lista de guiones).
export function screenplayStats(blocks: ScreenplayBlock[], size: PageSize = "A4") {
  const pages = scriptLength(blocks, size).printedPages;
  const scenes = sceneNumbering(blocks).size;
  const words = blocks
    .filter((b) => b.type !== "note")
    .reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
  const characters = new Set(
    blocks.filter((b) => b.type === "character" && b.text.trim()).map((b) => characterName(b.text)),
  );
  return { pages, scenes, words, characters: characters.size };
}
