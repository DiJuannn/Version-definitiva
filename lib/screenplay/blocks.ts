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

// Nombre llano de cada tipo de línea: es el que se enseña en toda la UI.
// El técnico (BLOCK_TECH) va pequeño al lado cuando ayude a quien ya sabe.
export const BLOCK_LABELS: Record<BlockType, string> = {
  sceneHeading: "Lugar y hora",
  action: "Lo que se ve",
  character: "Quién habla",
  parenthetical: "Cómo lo dice",
  dialogue: "Lo que dice",
  transition: "Cambio de escena",
  shot: "Plano",
  note: "Nota para ti",
};

export const BLOCK_TECH: Record<BlockType, string> = {
  sceneHeading: "Encabezado",
  action: "Acción",
  character: "Personaje",
  parenthetical: "Acotación",
  dialogue: "Diálogo",
  transition: "Transición",
  shot: "Plano",
  note: "Nota",
};

// Pista corta: qué se escribe en esa línea, con un ejemplo cuando hace falta.
export const BLOCK_HINTS: Record<BlockType, string> = {
  sceneHeading: "Dónde y cuándo: INT. COCINA - NOCHE",
  action: "Lo que se ve y se oye, en presente",
  character: "El nombre de quien habla, en mayúsculas",
  dialogue: "Lo que dice, sin comillas",
  parenthetical: "Un gesto o tono, muy breve: (en voz baja)",
  transition: "Casi nunca hace falta: CORTE A:",
  shot: "Un plano concreto: PRIMER PLANO - LA CARTA",
  note: "Solo para ti, no se imprime",
};

// Un ejemplo de cada tipo, tal como se vería en la página (menús, guías).
export const BLOCK_EXAMPLES: Record<BlockType, string> = {
  sceneHeading: "INT. COCINA - NOCHE",
  action: "Lucía abre la nevera.",
  character: "LUCÍA",
  parenthetical: "(en voz baja)",
  dialogue: "No queda leche.",
  transition: "CORTE A:",
  shot: "PRIMER PLANO - LA CARTA",
  note: "¿Y si la carta ya estaba abierta?",
};

// Atajo Ctrl+Alt + número (⌘⌥ + número en Mac) para cambiar la línea actual.
// No es Ctrl + número a secas porque en Chrome y Firefox eso cambia de pestaña
// del navegador (por eso Google Docs también usa Ctrl+Alt).
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

// Combinación de teclas para el keymap de ProseMirror.
export const blockShortcutKeys = (type: BlockType) => `Mod-Alt-${BLOCK_SHORTCUTS[type]}`;

// Cómo se escribe el atajo para enseñarlo: «Ctrl+Alt+1» o «⌘⌥1».
export function shortcutLabel(type: BlockType, mac = false): string {
  return mac ? `⌘⌥${BLOCK_SHORTCUTS[type]}` : `Ctrl+Alt+${BLOCK_SHORTCUTS[type]}`;
}

// Al pulsar Enter al final de una línea, la siguiente nace de este tipo.
// Tras lo que dice alguien se vuelve a «Lo que se ve»: es lo que casi siempre
// viene después y así nadie escribe una descripción en la línea de un nombre
// sin querer. Para que hable otra persona: Enter y luego Tab.
export const ENTER_NEXT: Record<BlockType, BlockType> = {
  sceneHeading: "action",
  action: "action",
  character: "dialogue",
  parenthetical: "dialogue",
  dialogue: "action",
  transition: "sceneHeading",
  shot: "action",
  note: "action",
};

// Tab sobre una línea cambia su tipo (como en Final Draft). En una línea
// vacía de «Lo que se ve», Tab → «Quién habla»; en «Lo que dice», Tab →
// «Cómo lo dice».
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

// En una línea vacía, Enter cambia su tipo en vez de crear otra (Final Draft):
// una línea de «Quién habla» o «Lo que dice» que se queda vacía vuelve a ser
// «Lo que se ve» con un solo Enter. Nunca hacen falta dos.
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

// ¿Esta línea es una transición? Las de la lista se reconocen aunque se
// escriban en minúsculas («corte a:»); el patrón general, solo en mayúsculas
// (para no confundir «Le dijo a:» con un cambio de escena).
export function looksLikeTransition(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const upper = t.toUpperCase();
  if (TRANSITIONS.includes(upper)) return true;
  return t === upper && TRANSITION_PATTERN.test(t);
}

// ¿Una línea escrita como «Lugar y hora» parece en realidad una frase? Sin
// INT./EXT., sin « - » (el momento del día), escrita en minúsculas y con más
// de 4 palabras o acabada en punto: «Mi abuela vive sola en un pueblo.» Las
// que no lo parecen («COCINA», «casa de Lucía - noche») se dejan donde están.
export function headingLooksLikeSentence(text: string): boolean {
  const t = text.trim();
  if (!t || SCENE_PREFIX.test(`${t} `) || / - /.test(t) || !/\p{Ll}/u.test(t)) return false;
  const words = t.split(/\s+/).length;
  return words > 4 || (/[.!?…]$/.test(t) && words >= 2);
}

// ¿Una línea de «Quién habla» parece una descripción? (la «trampa del Enter»:
// «Lucía cierra la ventana y suspira.»). Los nombres escritos en mayúsculas
// nunca: «EL HOMBRE DEL SOMBRERO GRIS» es un personaje.
export function characterLooksLikeSentence(text: string): boolean {
  const t = text.replace(/\(.*?\)/g, "").trim();
  if (!t || !/\p{Ll}/u.test(t)) return false;
  const words = t.split(/\s+/).length;
  return words > 4 || (/[.!?…]$/.test(t) && words >= 3);
}

// ------------------------------------------------------------- numeración

// Un único sitio decide qué es una escena y qué número lleva, para que el
// editor, la tira, la Radiografía, el PDF y producción digan lo mismo.
// Cuenta todo encabezado con texto y también los vacíos que ya tienen algo
// escrito debajo (escenas que nacen de una idea suelta): en el PDF salen como
// «ESCENA SIN ENCABEZADO» para que el número no se descuadre.
export const UNTITLED_HEADING = "ESCENA SIN ENCABEZADO";

type NumberingItem = { type: string; text: string };

// Número de escena de cada bloque que abre escena (índice → número).
export function sceneNumbering(blocks: readonly NumberingItem[]): Map<number, number> {
  const out = new Map<number, number>();
  let n = 0;
  let pending = -1; // encabezado vacío que aún espera texto debajo
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === "sceneHeading") {
      pending = -1;
      if (b.text.trim()) out.set(i, ++n);
      else pending = i;
    } else if (pending !== -1 && b.text.trim()) {
      out.set(pending, ++n);
      pending = -1;
    }
  }
  return out;
}

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
