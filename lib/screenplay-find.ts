// Buscar y reemplazar en el guion, y renombrar un personaje en todo el
// guion. Puro: trabaja con la lista de líneas (tipo + texto) y devuelve
// posiciones dentro de cada línea; el editor las convierte en posiciones del
// documento. Se prueba en tests/unit/ayudas-find.test.ts.

import { characterName, type BlockType } from "@/lib/screenplay/blocks";

export type FindLine = { type: BlockType; text: string };

export type FindOptions = {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  types?: readonly BlockType[] | null; // null: en todo el guion
};

export type FindMatch = { line: number; from: number; to: number };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Letras y números de cualquier idioma: «Ana» no casa dentro de «Anabel».
const WORD_BEFORE = "(?<![\\p{L}\\p{N}_])";
const WORD_AFTER = "(?![\\p{L}\\p{N}_])";

export function findPattern({ query, caseSensitive = false, wholeWord = false }: FindOptions): RegExp | null {
  if (!query) return null;
  const body = escapeRegExp(query);
  return new RegExp(wholeWord ? `${WORD_BEFORE}${body}${WORD_AFTER}` : body, `gu${caseSensitive ? "" : "i"}`);
}

export function findMatches(lines: readonly FindLine[], opts: FindOptions, limit = 2000): FindMatch[] {
  const re = findPattern(opts);
  if (!re) return [];
  const out: FindMatch[] = [];
  lines.forEach((l, line) => {
    if (opts.types && !opts.types.includes(l.type)) return;
    re.lastIndex = 0;
    for (let m = re.exec(l.text); m && out.length < limit; m = re.exec(l.text)) {
      if (!m[0].length) {
        re.lastIndex++;
        continue;
      }
      out.push({ line, from: m.index, to: m.index + m[0].length });
    }
  });
  return out;
}

// La coincidencia más cercana a partir de una posición (línea, carácter).
export function nearestMatch(matches: readonly FindMatch[], line: number, ch: number): number {
  const i = matches.findIndex((m) => m.line > line || (m.line === line && m.to > ch));
  return i === -1 ? 0 : i;
}

// ------------------------------------------------------------------ renombrar un personaje

export type TextEdit = { line: number; from: number; to: number; text: string };

export type RenamePlan = {
  from: string;
  to: string;
  edits: TextEdit[];
  speaking: number; // líneas de «Quién habla»
  mentions: number; // menciones en lo que se ve, lo que dice…
};

// «LUCÍA» → «Lucía», «DON PEDRO» → «Don Pedro».
export function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w) => (w.trim() && w !== "-" ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join("");
}

// Cambia el nombre en las líneas de «Quién habla» (conservando «(V.O.)» y
// demás) y las menciones en el resto del texto, en MAYÚSCULAS («LUCÍA entra»)
// o como nombre propio («le dice a Lucía»). Solo palabras enteras.
export function planRename(lines: readonly FindLine[], oldName: string, newName: string): RenamePlan | null {
  const from = characterName(oldName);
  const to = characterName(newName);
  if (!from || !to || from === to) return null;
  const upper = new RegExp(`${WORD_BEFORE}${escapeRegExp(from)}${WORD_AFTER}`, "gu");
  const title = titleCase(from);
  const proper = title !== from ? new RegExp(`${WORD_BEFORE}${escapeRegExp(title)}${WORD_AFTER}`, "gu") : null;
  const edits: TextEdit[] = [];
  let speaking = 0;
  let mentions = 0;
  lines.forEach((l, line) => {
    if (l.type === "character") {
      if (characterName(l.text) !== from) return;
      const start = l.text.search(/\S/);
      // El nombre es lo primero de la línea, en las mayúsculas o minúsculas que tenga.
      const len = from.length;
      if (start < 0 || l.text.slice(start, start + len).toUpperCase() !== from) return;
      edits.push({ line, from: start, to: start + len, text: to });
      speaking++;
      return;
    }
    if (l.type === "note") return; // las notas son tuyas: no se tocan
    for (const [re, replacement] of [
      [upper, to],
      [proper, titleCase(to)],
    ] as const) {
      if (!re) continue;
      re.lastIndex = 0;
      for (let m = re.exec(l.text); m; m = re.exec(l.text)) {
        edits.push({ line, from: m.index, to: m.index + m[0].length, text: replacement });
        mentions++;
      }
    }
  });
  edits.sort((a, b) => a.line - b.line || a.from - b.from);
  return { from, to, edits, speaking, mentions };
}

// Aplica cambios a una lista de líneas (para los tests y para comprobar
// antes de tocar el documento). Los cambios no se pisan entre sí.
export function applyEdits(lines: readonly FindLine[], edits: readonly TextEdit[]): FindLine[] {
  const byLine = new Map<number, TextEdit[]>();
  for (const e of edits) byLine.set(e.line, [...(byLine.get(e.line) ?? []), e]);
  return lines.map((l, i) => {
    const list = byLine.get(i);
    if (!list) return l;
    let text = l.text;
    for (const e of [...list].sort((a, b) => b.from - a.from)) text = text.slice(0, e.from) + e.text + text.slice(e.to);
    return { ...l, text };
  });
}
