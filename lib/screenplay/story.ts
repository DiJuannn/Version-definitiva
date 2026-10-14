// La historia por encima del texto: escenas con identidad propia, estructura
// en actos, orden cronológico, tensión, fichas de personaje y referencias.
//
// Todo esto vive en el mismo documento Yjs que el texto (mapas aparte del
// fragmento del editor): viaja en tiempo real a todo el equipo y se guarda con
// el guion sin tablas nuevas. Este archivo no depende de Yjs: son los tipos y
// los cálculos que se hacen a partir de los bloques.

import { characterName, parseSceneHeading, type ScreenplayBlock } from "@/lib/screenplay/blocks";
import { layoutScreenplay, linesPerPage, type PageSize } from "@/lib/screenplay/layout";

// ------------------------------------------------------------------ tipos

export type SceneMeta = {
  synopsis?: string; // la tarjeta del corcho, en palabras del guionista
  tension?: number; // 0-10, la curva de tensión
  color?: string; // clave de SCENE_COLORS
};

export type StoryImage = { id: string; url: string; caption?: string };

// Lo que hay antes del guion (paso "Idea"). Todo opcional: se puede ir
// directo a escribir y volver aquí cuando se quiera.
export const DEV_FIELDS = [
  { key: "idea", label: "La idea", hint: "En una frase, como se la contarías a alguien.", rows: 2 },
  { key: "thesis", label: "Qué quieres contar", hint: "Tu tesis: lo que la historia dice sin decirlo.", rows: 2 },
  { key: "logline", label: "Logline", hint: "Protagonista, lo que quiere y lo que se lo impide.", rows: 2 },
  { key: "synopsis", label: "Sinopsis", hint: "La historia de principio a fin, en un párrafo o dos.", rows: 3 },
  { key: "tone", label: "Tono y mundo", hint: "Cómo se ve, cómo suena, qué se siente.", rows: 2 },
] as const;

export type DevKey = (typeof DEV_FIELDS)[number]["key"];

export type CharacterMeta = {
  images?: StoryImage[];
  added?: boolean; // creado a mano en la Idea, antes de tener diálogos
  want?: string; // qué quiere
  need?: string; // qué necesita de verdad
  fear?: string;
  secret?: string;
  arc?: string;
  notes?: string;
};

export const REFERENCE_KINDS = {
  film: "Película",
  scene: "Escena de referencia",
  series: "Serie",
  book: "Libro",
  art: "Pintura / fotografía",
  music: "Música",
  place: "Escenario / localización",
  editing: "Idea de montaje",
  direction: "Nota de dirección",
  character: "Me recuerda a…",
  other: "Otra",
} as const;

export type ReferenceKind = keyof typeof REFERENCE_KINDS;

export type ReferenceAnchor =
  | { type: "script" }
  | { type: "scene"; sid: string }
  | { type: "character"; name: string };

export type Reference = {
  id: string;
  kind: ReferenceKind;
  title: string;
  detail?: string; // por qué sirve / qué mirar
  year?: string;
  author?: string; // director/a, autor/a, artista
  url?: string;
  image?: string; // imagen subida (se ve en la ficha y va al Moodboard)
  anchor: ReferenceAnchor;
  source: "manual" | "ai";
  by?: string; // nombre de quien la añadió
  at: number;
};

// Lo que la IA ha entendido de la historia. El equipo puede corregirlo: las
// correcciones pasan a ser la base de las siguientes ayudas.
export type StoryReading = {
  premise: string;
  themes: string[];
  tone: string;
  genre: string;
  characters: { name: string; want: string; obstacle: string; arc: string }[];
  structure: string;
  openQuestions: string[];
  at: number;
  editedBy?: string;
};

export type Suggestion = Omit<Reference, "source" | "by"> & { source: "ai" };

export type Questions = { scope: string; items: string[]; at: number };

export const ACT_TEMPLATES = {
  three: { label: "3 actos", acts: ["Acto I", "Acto II", "Acto III"] },
  five: { label: "5 actos", acts: ["Acto I", "Acto II", "Acto III", "Acto IV", "Acto V"] },
  free: { label: "Libre", acts: [] as string[] },
} as const;

export type ActTemplate = keyof typeof ACT_TEMPLATES;

export const SCENE_COLORS: Record<string, { label: string; value: string }> = {
  none: { label: "Sin color", value: "transparent" },
  violet: { label: "Violeta", value: "#a08fd0" },
  amber: { label: "Ámbar", value: "#e3b25c" },
  green: { label: "Verde", value: "#6dbf8b" },
  red: { label: "Rojo", value: "#ef6b62" },
  blue: { label: "Azul", value: "#6ea8e0" },
};

// ------------------------------------------------------------------ escenas

export type SceneInfo = {
  sid: string;
  number: number;
  heading: string;
  place: string;
  time: string;
  start: number; // índice del bloque del encabezado
  end: number; // índice (exclusivo) del final de la escena
  speakers: string[]; // personajes que hablan
  present: string[]; // hablan o se les nombra en la acción
  eighths: number; // duración en octavos de página (como en producción)
  firstAction: string;
};

export function formatEighths(eighths: number): string {
  if (eighths <= 0) return "—";
  const pages = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (!pages) return `${rest}/8`;
  return rest ? `${pages} ${rest}/8` : `${pages}`;
}

export function scenesFromBlocks(blocks: ScreenplayBlock[], size: PageSize = "A4"): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  const headings = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.type === "sceneHeading" && b.text.trim() && b.id);
  if (!headings.length) return scenes;

  // Líneas impresas por bloque, para medir cada escena en octavos.
  const linesByBlock = new Map<number, number>();
  for (const page of layoutScreenplay(blocks, { size })) {
    for (const line of page.lines) {
      if (line.block !== undefined) linesByBlock.set(line.block, (linesByBlock.get(line.block) ?? 0) + 1);
    }
  }
  const perPage = linesPerPage(size);

  const allSpeakers = new Set(
    blocks.filter((b) => b.type === "character" && b.text.trim()).map((b) => characterName(b.text)),
  );

  headings.forEach(({ b, i }, n) => {
    const end = headings[n + 1]?.i ?? blocks.length;
    const body = blocks.slice(i + 1, end);
    const speakers = [...new Set(body.filter((x) => x.type === "character" && x.text.trim()).map((x) => characterName(x.text)))];
    const actionText = body
      .filter((x) => x.type === "action")
      .map((x) => x.text)
      .join(" ");
    const mentioned = [...allSpeakers].filter(
      (name) => !speakers.includes(name) && new RegExp(`(^|[^\\p{L}])${escapeRegExp(name)}([^\\p{L}]|$)`, "iu").test(actionText),
    );
    let lines = 0;
    for (let k = i; k < end; k++) lines += linesByBlock.get(k) ?? 0;
    const { place, time } = parseSceneHeading(b.text);
    scenes.push({
      sid: b.id!,
      number: n + 1,
      heading: b.text.trim().toUpperCase(),
      place,
      time,
      start: i,
      end,
      speakers,
      present: [...speakers, ...mentioned],
      eighths: lines ? Math.max(1, Math.round((lines / perPage) * 8)) : 0,
      firstAction: body.find((x) => x.type === "action" && x.text.trim())?.text.trim() ?? "",
    });
  });
  return scenes;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function characterNames(blocks: ScreenplayBlock[]): { name: string; lines: number }[] {
  const counts = new Map<string, number>();
  let speaker: string | null = null;
  for (const b of blocks) {
    if (b.type === "character") {
      speaker = characterName(b.text) || null;
      if (speaker && !counts.has(speaker)) counts.set(speaker, 0);
    } else if (b.type === "dialogue" && speaker) counts.set(speaker, (counts.get(speaker) ?? 0) + 1);
    else if (b.type !== "parenthetical") speaker = null;
  }
  return [...counts.entries()].map(([name, lines]) => ({ name, lines })).sort((a, b) => b.lines - a.lines);
}

// Lo que dice un personaje, escena a escena (hilo de personaje).
export function characterThread(blocks: ScreenplayBlock[], scenes: SceneInfo[], name: string) {
  return scenes
    .filter((s) => s.present.includes(name))
    .map((s) => {
      const lines: string[] = [];
      let speaking = false;
      for (const b of blocks.slice(s.start + 1, s.end)) {
        if (b.type === "character") speaking = characterName(b.text) === name;
        else if (b.type === "dialogue" && speaking) lines.push(b.text.trim());
        else if (b.type !== "parenthetical") speaking = false;
      }
      return { scene: s, lines, speaks: s.speakers.includes(name) };
    });
}

// Orden de la historia (cronológico): el guardado primero, luego las escenas
// nuevas en orden de pantalla. Ids de escenas que ya no existen se ignoran.
export function storyOrder(scenes: SceneInfo[], saved: string[] | undefined): SceneInfo[] {
  const byId = new Map(scenes.map((s) => [s.sid, s]));
  const seen = new Set<string>();
  const out: SceneInfo[] = [];
  for (const sid of saved ?? []) {
    const s = byId.get(sid);
    if (s && !seen.has(sid)) {
      out.push(s);
      seen.add(sid);
    }
  }
  for (const s of scenes) if (!seen.has(s.sid)) out.push(s);
  return out;
}

export function referenceId(): string {
  return `r${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function isReferenceKind(v: unknown): v is ReferenceKind {
  return typeof v === "string" && v in REFERENCE_KINDS;
}

// Enlaces que se pueden abrir desde la tarjeta (solo http/https).
export function safeUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
