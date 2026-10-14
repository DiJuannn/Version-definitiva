// Tipos de bloque de un guion y cómo se pasa de uno a otro al escribir.
// Es la misma lista en el editor (nodos de TipTap), en el PDF, en Fountain
// y en las estadísticas: si se añade un tipo nuevo, se añade aquí primero.

export const BLOCK_TYPES = [
  "sceneHeading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
  "shot",
  "note",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

// `id` solo lo llevan los encabezados: identifica la escena aunque se mueva
// o se renumere (corcho, referencias, tensión… se guardan con este id).
export type ScreenplayBlock = { type: BlockType; text: string; id?: string };

export function newSceneId(): string {
  return `s${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export const BLOCK_LABELS: Record<BlockType, string> = {
  sceneHeading: "Encabezado",
  action: "Acción",
  character: "Personaje",
  parenthetical: "Acotación",
  dialogue: "Diálogo",
  transition: "Transición",
  shot: "Plano",
  note: "Nota",
};

// Atajo Ctrl/⌘ + número para cambiar el bloque actual directamente.
export const BLOCK_SHORTCUTS: Record<BlockType, string> = {
  sceneHeading: "1",
  action: "2",
  character: "3",
  parenthetical: "4",
  dialogue: "5",
  transition: "6",
  shot: "7",
  note: "8",
};

// Al pulsar Enter al final de un bloque, el siguiente nace de este tipo.
export const ENTER_NEXT: Record<BlockType, BlockType> = {
  sceneHeading: "action",
  action: "action",
  character: "dialogue",
  parenthetical: "dialogue",
  dialogue: "character",
  transition: "sceneHeading",
  shot: "action",
  note: "action",
};

// Tab sobre un bloque cambia su tipo (como en Final Draft).
export const TAB_NEXT: Record<BlockType, BlockType> = {
  sceneHeading: "action",
  action: "character",
  character: "action",
  parenthetical: "dialogue",
  dialogue: "parenthetical",
  transition: "sceneHeading",
  shot: "action",
  note: "action",
};

// En un bloque vacío, Enter cambia su tipo en vez de crear otro (Final Draft):
// tras un diálogo, un Enter de más deja de ser "Personaje" y pasa a "Acción".
export const EMPTY_ENTER: Partial<Record<BlockType, BlockType>> = {
  character: "action",
  dialogue: "action",
  parenthetical: "dialogue",
  transition: "action",
  shot: "action",
  sceneHeading: "action",
};

export function isBlockType(v: unknown): v is BlockType {
  return typeof v === "string" && (BLOCK_TYPES as readonly string[]).includes(v);
}

export const SCENE_PREFIX = /^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT|EST)[.\s]/i;
export const TIME_OF_DAY = ["DÍA", "NOCHE", "ATARDECER", "AMANECER", "CONTINUO", "MÁS TARDE", "MOMENTOS DESPUÉS"];
export const SCENE_PREFIXES = ["INT.", "EXT.", "INT./EXT."];
export const TRANSITIONS = ["CORTE A:", "FUNDIDO A NEGRO.", "FUNDIDO A:", "ENCADENADO A:", "CORTE SECO A:", "FADE IN:", "FADE OUT."];

// "CORTE A:", "FUNDIDO A:", "CUT TO:"… una línea en mayúsculas acabada en "A:" o "TO:".
export const TRANSITION_PATTERN = /^[A-ZÁÉÍÓÚÑÜ ]+ (A|TO):$/;

// Nombre del personaje sin extensiones: "LUCÍA (V.O.)" → "LUCÍA".
export function characterName(text: string): string {
  return text
    .replace(/\(.*?\)/g, "")
    .replace(/\^$/, "")
    .trim()
    .toUpperCase();
}

// "INT. COCINA - NOCHE" → { place: "COCINA", time: "NOCHE" }
export function parseSceneHeading(text: string): { prefix: string; place: string; time: string } {
  const upper = text.trim().toUpperCase();
  const m = upper.match(SCENE_PREFIX);
  const prefix = m ? upper.slice(0, m[0].length).trim() : "";
  const rest = upper.slice(prefix.length).trim();
  const dash = rest.lastIndexOf(" - ");
  if (dash === -1) return { prefix, place: rest, time: "" };
  return { prefix, place: rest.slice(0, dash).trim(), time: rest.slice(dash + 3).trim() };
}

// Shift+Tab: el camino de vuelta de Tab.
export const SHIFT_TAB_NEXT: Record<BlockType, BlockType> = {
  sceneHeading: "transition",
  action: "sceneHeading",
  character: "action",
  parenthetical: "dialogue",
  dialogue: "character",
  transition: "action",
  shot: "action",
  note: "action",
};
