// El Compañero del guion: hace UNA pregunta sobre lo que acabas de escribir.
// Nunca escribe guion (ver GUARDRAIL en lib/screenplay-ai.ts).
//
// Aquí solo hay datos y cálculos puros, sin IA ni React: los usa el servidor
// (para validar lo que pide el navegador y lo que devuelve la IA) y el
// navegador (cuándo ofrecer una tarjeta y preguntas de oficio sin IA cuando
// la IA no está, no responde o no queda cupo).

import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import type { SceneInfo } from "@/lib/screenplay/story";

// ------------------------------------------------------------------ foco

// Sobre qué se pregunta: una escena del guion, una respuesta del arranque
// guiado (preguntas 3 y 4) o una tarjeta del esqueleto.
export type CoachFocus =
  | { kind: "scene"; sid: string }
  | { kind: "answer"; step: 3 | 4; text: string }
  | { kind: "card"; index: number; text: string };

// Lo que llega del navegador no es de fiar: forma y longitudes.
export function cleanCoachFocus(v: unknown): CoachFocus | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.kind === "scene" && typeof o.sid === "string" && o.sid.trim()) return { kind: "scene", sid: o.sid.trim().slice(0, 40) };
  if (o.kind === "answer" && (o.step === 3 || o.step === 4) && typeof o.text === "string" && o.text.trim())
    return { kind: "answer", step: o.step, text: o.text.trim().slice(0, 1200) };
  if (o.kind === "card" && typeof o.index === "number" && Number.isFinite(o.index) && typeof o.text === "string" && o.text.trim())
    return { kind: "card", index: Math.max(0, Math.min(40, Math.round(o.index))), text: o.text.trim().slice(0, 1200) };
  return null;
}

// ------------------------------------------------------------------ resultado

export type CoachSource = "ai" | "local";

export type CoachQuestion = {
  question: string;
  why: string; // «Lo pregunto porque…»
  source: CoachSource;
  sid: string | null;
  at: number;
};

export type SceneCheck = { ok: true } | { ok: false; observation: string; format?: string };

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

// ¿Parece texto de guion en vez de una pregunta? (diálogo con raya o
// comillas, una línea de personaje en mayúsculas seguida de texto, un
// encabezado…). El GUARDRAIL lo prohíbe; esto es la red por si acaso.
export function looksLikeScript(text: string): boolean {
  const t = text.trim();
  if (/^(INT|EXT)\.?\s/i.test(t)) return true;
  if (/^[—–-]\s?\S/.test(t)) return true;
  if (/^[A-ZÁÉÍÓÚÑ]{2,}( [A-ZÁÉÍÓÚÑ]{2,})*\s*[:\n]/.test(t)) return true;
  if (/^[«"“].+[»"”]$/.test(t) && !/\?/.test(t)) return true;
  return false;
}

// Una pregunta válida: con «?», corta, sin pinta de guion.
export function isGoodQuestion(text: string, maxWords = 32): boolean {
  if (!text || !/\?/.test(text)) return false;
  if (words(text) < 3 || words(text) > maxWords) return false;
  return !looksLikeScript(text);
}

// Respuesta de la IA a coachQuestion: {"pregunta", "motivo"}.
export function parseCoachQuestion(raw: unknown): { question: string; why: string } | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const question = clip(o.pregunta, 260);
  if (!isGoodQuestion(question)) return null;
  let why = clip(o.motivo, 220);
  if (why && !/^lo pregunto porque/i.test(why)) why = `Lo pregunto porque ${why.charAt(0).toLowerCase()}${why.slice(1)}`;
  if (why && !/[.!?…]$/.test(why)) why += ".";
  return { question, why };
}

// Respuesta de la IA a coachSceneCheck: {"ok"} o {"ok": false, "observacion", "formato"?}.
export function parseSceneCheck(raw: unknown): SceneCheck | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  if (o.ok === true) return { ok: true };
  const observation = clip(o.observacion, 260);
  if (!isGoodQuestion(observation, 34)) return null;
  const format = clip(o.formato, 140);
  return format && !looksLikeScript(format) && words(format) <= 20 ? { ok: false, observation, format } : { ok: false, observation };
}

// ------------------------------------------------------------------ preguntas de oficio (sin IA)

// Cuando no hay IA (o no responde, o se acabó el cupo del día): preguntas de
// oficio con los nombres reales de la escena. No son tan finas como las de la
// IA, pero hacen lo mismo: obligan a decidir, no deciden por ti.
type Bank = { q: (c: LocalCtx) => string | null; why: string }[];
type LocalCtx = { p: string; other: string | null; n: number; hasDialogue: boolean; hasAction: boolean };

const SCENE_BANK: Bank = [
  { q: (c) => `¿Qué quiere ${c.p} en la escena ${c.n}, y qué se lo impide?`, why: "Lo pregunto porque una escena se mueve cuando alguien quiere algo y le cuesta." },
  { q: (c) => `¿Qué ha cambiado al final de la escena ${c.n} respecto al principio?`, why: "Lo pregunto porque si nada cambia, la escena se puede quitar." },
  { q: (c) => `¿Qué sabe el público aquí que ${c.p} todavía no sabe?`, why: "Lo pregunto porque esa diferencia crea tensión sin tener que explicarla." },
  { q: (c) => (c.other ? `¿Qué quiere ${c.p} de ${c.other} en esta escena?` : null), why: "Lo pregunto porque dos personajes juntos funcionan mejor si uno necesita algo del otro." },
  { q: (c) => `¿Cómo veríamos lo que siente ${c.p} sin que lo diga?`, why: "Lo pregunto porque en cine lo que se ve pesa más que lo que se cuenta." },
  { q: (c) => (c.hasDialogue ? `¿Qué se calla ${c.p} en esta escena?` : null), why: "Lo pregunto porque lo que un personaje no dice también cuenta la historia." },
  { q: (c) => (!c.hasDialogue && c.hasAction ? `¿Alguien dice algo en la escena ${c.n}, o el silencio cuenta más?` : null), why: "Lo pregunto porque tanto una frase como un silencio son una decisión." },
  { q: (c) => `Si quitaras la escena ${c.n}, ¿qué echaría de menos la historia?`, why: "Lo pregunto porque así se ve para qué sirve cada escena." },
  { q: () => `¿Qué tiene que pasar en la escena siguiente por culpa de esta?`, why: "Lo pregunto porque las escenas enlazadas por causa y efecto empujan la historia." },
];

const STUCK_BANK: Bank = [
  { q: (c) => `¿Qué es lo peor que le podría pasar a ${c.p} ahora mismo?`, why: "Lo pregunto porque cuando no sabes cómo seguir, complicarle la vida al protagonista suele abrir camino." },
  { q: (c) => `¿Qué decisión está evitando ${c.p}?`, why: "Lo pregunto porque obligarle a decidir suele ser la siguiente escena." },
  { q: () => `¿Cuál es la escena que más ganas tienes de escribir, aunque no sea la siguiente?`, why: "Lo pregunto porque no hace falta escribir en orden: el resto se ordena después." },
];

function sceneContext(blocks: ScreenplayBlock[], scene: SceneInfo | undefined): LocalCtx {
  const body = scene ? blocks.slice(scene.start + 1, scene.end) : [];
  const people = scene ? [...scene.speakers, ...scene.present.filter((p) => !scene.speakers.includes(p))] : [];
  const pretty = (name: string) => name.charAt(0) + name.slice(1).toLowerCase();
  return {
    p: people[0] ? pretty(people[0]) : "tu protagonista",
    other: people[1] ? pretty(people[1]) : null,
    n: scene?.number ?? 1,
    hasDialogue: body.some((b) => b.type === "dialogue" && b.text.trim()),
    hasAction: body.some((b) => b.type === "action" && b.text.trim()),
  };
}

// `skip`: preguntas ya hechas en esta sesión (no se repiten mientras haya otras).
export function localCoachQuestion(
  blocks: ScreenplayBlock[],
  scenes: SceneInfo[],
  sid: string | null,
  { skip = [], stuck = false, seed = 0 }: { skip?: string[]; stuck?: boolean; seed?: number } = {},
): CoachQuestion {
  const scene = scenes.find((s) => s.sid === sid);
  const ctx = sceneContext(blocks, scene);
  const bank = stuck ? [...STUCK_BANK, ...SCENE_BANK] : SCENE_BANK;
  const all = bank
    .map((b) => ({ question: b.q(ctx), why: b.why }))
    .filter((x): x is { question: string; why: string } => Boolean(x.question));
  const fresh = all.filter((x) => !skip.includes(x.question));
  const pool = fresh.length ? fresh : all;
  const pick = pool[Math.abs(Math.floor(seed)) % pool.length];
  return { ...pick, source: "local", sid: scene?.sid ?? null, at: Date.now() };
}

// ------------------------------------------------------------------ cuándo ofrecer una tarjeta

export const COACH_MIN_GAP_MS = 5 * 60_000; // como mucho una tarjeta cada 5 min
export const COACH_IDLE_MS = 2 * 60_000; // «¿atascada?» tras 2 min sin escribir
export const COACH_SCENE_MIN_BLOCKS = 4; // una escena «terminada» tiene al menos 4 líneas

export type CoachMode = "off" | "ask" | "auto"; // apagado · solo cuando lo pida · me pregunta solo

export function isCoachMode(v: unknown): v is CoachMode {
  return v === "off" || v === "ask" || v === "auto";
}

// Líneas con texto de una escena (sin contar notas ni el encabezado).
export function sceneWrittenLines(blocks: ScreenplayBlock[], scene: SceneInfo | undefined): number {
  if (!scene) return 0;
  return blocks.slice(scene.start + 1, scene.end).filter((b) => b.type !== "note" && b.text.trim()).length;
}

export type CoachTrigger = "scene-end" | "idle";

// ¿Toca ofrecer una tarjeta ahora? Solo en modo «Me pregunta solo», sin
// silenciar, sin otra tarjeta a la vista y si han pasado 5 min de la última.
export function coachDue({
  mode,
  muted,
  visible,
  lastShownAt,
  now,
  trigger,
  lines,
}: {
  mode: CoachMode;
  muted: boolean;
  visible: boolean;
  lastShownAt: number | null;
  now: number;
  trigger: CoachTrigger;
  lines: number; // líneas escritas de la escena en foco
}): boolean {
  if (mode !== "auto" || muted || visible) return false;
  if (lastShownAt !== null && now - lastShownAt < COACH_MIN_GAP_MS) return false;
  if (trigger === "scene-end") return lines >= COACH_SCENE_MIN_BLOCKS;
  return lines >= 1;
}

// La pregunta guardada en Ideas sueltas: se entiende sola al leerla después.
export function coachIdeaText(q: Pick<CoachQuestion, "question">, sceneNumber: number | null): string {
  return `${sceneNumber ? `Escena ${sceneNumber} · ` : ""}Pregunta del Compañero: ${q.question}`;
}
