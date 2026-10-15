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

// Revisión del guion por la IA: dudas concretas, ancladas a una escena.
export const REVIEW_KINDS = {
  setup: "Siembra sin recoger",
  character: "Personaje",
  continuity: "Continuidad",
  motivation: "Motivación",
  clarity: "Claridad",
  rhythm: "Ritmo",
  other: "Otra",
} as const;

export type ReviewKind = keyof typeof REVIEW_KINDS;
export type ReviewItem = { id: string; kind: ReviewKind; scene: number | null; sid: string | null; text: string };


export type Review = { items: ReviewItem[]; at: number };

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

// `untitled`: cuenta también las escenas aún sin encabezado (las que nacen de
// una idea suelta) si ya tienen algo escrito. Solo para escribir: producción
// necesita el encabezado.
export function scenesFromBlocks(blocks: ScreenplayBlock[], size: PageSize = "A4", { untitled = false } = {}): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  const hasBody = (i: number) => {
    for (let k = i + 1; k < blocks.length && blocks[k].type !== "sceneHeading"; k++) if (blocks[k].text.trim()) return true;
    return false;
  };
  const headings = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b, i }) => b.type === "sceneHeading" && b.id && (b.text.trim() || (untitled && hasBody(i))));
  if (!headings.length) return scenes;

  // Dónde empieza cada bloque en el guion impreso (página y línea), para
  // medir cada escena en octavos desde su inicio hasta el de la siguiente:
  // así la suma de las escenas cuadra con las páginas del guion.
  const perPage = linesPerPage(size);
  const startAt = new Map<number, number>();
  let endAt = 0;
  for (const page of layoutScreenplay(blocks, { size })) {
    page.lines.forEach((line, i) => {
      const at = (page.number - 1) * perPage + i;
      if (line.block !== undefined && !startAt.has(line.block)) startAt.set(line.block, at);
      endAt = at + 1;
    });
  }

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
    const from = startAt.get(i) ?? 0;
    const nextHeading = headings[n + 1]?.i;
    const to = nextHeading !== undefined ? (startAt.get(nextHeading) ?? endAt) : endAt;
    const lines = Math.max(0, to - from);
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

// ------------------------------------------------------------------ ideas sueltas

// Lo que se tiene antes de saber el orden: una imagen, una frase, un momento,
// un personaje, un final. Viven en el documento (mapa "loose") y se convierten
// en escenas cuando se quiera.
export const LOOSE_KINDS = {
  imagen: { label: "Imagen", tone: "#3c6fb0", bg: "#e6f0fb" },
  dialogo: { label: "Diálogo", tone: "#a2457a", bg: "#f6e8f0" },
  momento: { label: "Momento", tone: "#8c6d0e", bg: "#fbf2d5" },
  personaje: { label: "Personaje", tone: "#6b54b8", bg: "#efeaf9" },
  final: { label: "Final", tone: "#2d7a4c", bg: "#e5f4ea" },
  otro: { label: "Idea", tone: "#6d695f", bg: "#eeece6" },
} as const;

export type LooseKind = keyof typeof LOOSE_KINDS;

export type LooseIdea = {
  id: string;
  text: string;
  kind: LooseKind;
  at: number;
  by?: string;
  sid?: string; // escena en la que ya se usó
};

export function isLooseKind(v: unknown): v is LooseKind {
  return typeof v === "string" && v in LOOSE_KINDS;
}

// Una primera suposición de qué es, para no obligar a elegir (se cambia con un toque).
export function guessLooseKind(text: string): LooseKind {
  const t = text.trim();
  const low = t.toLowerCase();
  if (/^[—–-]\s?|^[«"“]/.test(t)) return "dialogo";
  if (/^[A-ZÁÉÍÓÚÑ]{2,}[A-ZÁÉÍÓÚÑ ]*(,|\s\(|:)/.test(t)) return "personaje";
  if (/\b(al final|acaba|termina|último plano|final)\b/.test(low)) return "final";
  if (/\b(plano|imagen|se ve|vemos|primer plano|silueta|reflejo)\b/.test(low)) return "imagen";
  if (/^(un|una|el|la|los|las)\s/i.test(t) && t.split(/\s+/).length <= 14 && !/\b(descubre|decide|encuentra|llega|huye|mata|besa|dice)\b/.test(low))
    return "imagen";
  return "momento";
}

// ------------------------------------------------------------------ estructura en tres actos

// Los momentos que sostienen una estructura en tres actos, con dónde suelen
// caer (proporción de la duración). Son orientativos: sirven para situarse,
// no para obligar.
export const BEATS = [
  { key: "inciting", label: "Detonante", at: 0.12, hint: "Lo que rompe la normalidad y pone la historia en marcha." },
  { key: "turn1", label: "Primer giro", at: 0.25, hint: "El protagonista se mete (o le meten) en el conflicto. Cierra el Acto I." },
  { key: "midpoint", label: "Punto medio", at: 0.5, hint: "Algo cambia el sentido de la búsqueda: una revelación, una falsa victoria." },
  { key: "turn2", label: "Segundo giro", at: 0.75, hint: "El peor momento, o la pista que lleva al final. Cierra el Acto II." },
  { key: "climax", label: "Clímax", at: 0.9, hint: "El enfrentamiento decisivo: se resuelve lo que estaba en juego." },
] as const;

export type BeatKey = (typeof BEATS)[number]["key"];

export function isBeatKey(v: unknown): v is BeatKey {
  return BEATS.some((b) => b.key === v);
}

// Cuatro maneras clásicas de abrir, y qué tipo de idea suelta encaja con cada una.
export const OPENINGS = [
  {
    key: "imagen",
    label: "Con una imagen que lo resume todo",
    hint: "Un plano que el espectador entenderá del todo al final.",
    example: "Como la bola de nieve de «Ciudadano Kane».",
    kinds: ["imagen"] as LooseKind[],
    question: "¿Qué imagen resume tu película?",
  },
  {
    key: "personaje",
    label: "Con el protagonista haciendo lo que le define",
    hint: "En un minuto sabemos quién es por lo que hace, no por lo que dice.",
    example: "Como Indiana Jones en el templo, al principio de «En busca del arca perdida».",
    kinds: ["personaje"] as LooseKind[],
    question: "¿Qué hace tu protagonista que lo define sin palabras?",
  },
  {
    key: "accion",
    label: "En mitad de algo",
    hint: "Entramos con la acción ya empezada; lo de antes se entiende después.",
    example: "Como el atraco del arranque de «El caballero oscuro».",
    kinds: ["momento", "dialogo"] as LooseKind[],
    question: "¿Qué está pasando ya cuando entramos?",
  },
  {
    key: "final",
    label: "Por el final",
    hint: "Enseñas cómo acaba y la película cuenta cómo se llegó ahí.",
    example: "Como el cadáver en la piscina de «El crepúsculo de los dioses».",
    kinds: ["final"] as LooseKind[],
    question: "¿Cómo acaba tu historia?",
  },
] as const;

export type OpeningKey = (typeof OPENINGS)[number]["key"];
