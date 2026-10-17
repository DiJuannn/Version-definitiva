"use server";

import * as Y from "yjs";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { isPro } from "@/lib/plan";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { SCREENPLAY_AI_FREE_DAILY_LIMIT, SCREENPLAY_AI_PRO_DAILY_LIMIT } from "@/lib/limits";
import { SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import {
  aiConfigured,
  askQuestions,
  findStructure,
  proposeOpenings,
  reviewScript,
  type BeatProposal,
  type OpeningProposal,
  hasEnoughText,
  readStory,
  suggestReferences,
  type SuggestScope,
  coachQuestion,
  coachSceneCheck,
  coachSceneCheckPrompt,
} from "@/lib/screenplay-ai";
import { scenesFromBlocks, type Questions, type Review, type StoryReading, type Suggestion } from "@/lib/screenplay/story";
import { blocksFromYDoc } from "@/lib/screenplay/ydoc";
import {
  cleanCoachFocus,
  localCoachQuestion,
  type CoachFocus,
  type CoachQuestion,
  type SceneCheck,
} from "@/lib/screenplay-coach";

type Fail = { ok: false; error: string; upgrade?: boolean };

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

// El editor guarda justo antes de llamar aquí, así la IA lee lo último.
async function load(id: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Tu sesión ha caducado. Vuelve a entrar." } as const;
  const screenplay = await prisma.screenplay.findFirst({
    where: { id, organizationId: profile.organizationId },
    select: { id: true, title: true, format: true, logline: true, ydoc: true },
  });
  if (!screenplay) return { error: "Este guion ya no existe." } as const;
  const doc = new Y.Doc();
  if (screenplay.ydoc) Y.applyUpdate(doc, new Uint8Array(screenplay.ydoc));
  return {
    doc,
    pro: isPro(profile.organization.plan),
    ctx: { title: screenplay.title, format: SCREENPLAY_FORMAT_LABELS[screenplay.format], logline: screenplay.logline },
  };
}

// Cuenta un uso del día de forma atómica (dos clics a la vez no se cuelan).
async function claim(id: string, pro: boolean): Promise<boolean> {
  const limit = pro ? SCREENPLAY_AI_PRO_DAILY_LIMIT : SCREENPLAY_AI_FREE_DAILY_LIMIT;
  const day = todayKey();
  const rows = await prisma.$queryRaw<{ aiCount: number }[]>`
    UPDATE "Screenplay"
    SET "aiCount" = CASE WHEN "aiDay" = ${day} THEN "aiCount" + 1 ELSE 1 END, "aiDay" = ${day}
    WHERE "id" = ${id} AND ("aiDay" IS DISTINCT FROM ${day} OR "aiCount" < ${limit})
    RETURNING "aiCount"`;
  return rows.length > 0;
}

async function refund(id: string) {
  await prisma.$executeRaw`UPDATE "Screenplay" SET "aiCount" = GREATEST("aiCount" - 1, 0) WHERE "id" = ${id}`.catch(() => undefined);
}

async function run<T>(id: string, fn: (loaded: Exclude<Awaited<ReturnType<typeof load>>, { error: string }>) => Promise<T>): Promise<
  { ok: true; value: T } | Fail
> {
  if (!aiConfigured()) return { ok: false, error: "La IA no está configurada en este servidor." };
  const loaded = await load(id);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Error" };
  if (!hasEnoughText(loaded.doc)) {
    return { ok: false, error: "Todavía hay muy poco escrito. Escribe la idea o una escena y vuelve a probar." };
  }
  if (!(await claim(id, loaded.pro))) {
    return loaded.pro
      ? { ok: false, error: `Has usado las ${SCREENPLAY_AI_PRO_DAILY_LIMIT} ayudas de IA de hoy en este guion. Mañana tendrás más.` }
      : {
          ok: false,
          upgrade: true,
          error: `Has usado las ${SCREENPLAY_AI_FREE_DAILY_LIMIT} ayudas de IA de hoy en este guion. Con PRO tienes hasta ${SCREENPLAY_AI_PRO_DAILY_LIMIT} al día.`,
        };
  }
  try {
    return { ok: true, value: await withMistralSlot(() => fn(loaded)) };
  } catch (error) {
    await refund(id);
    if (error instanceof MistralBusyError) return { ok: false, error: "La IA está muy ocupada ahora mismo. Prueba en un minuto." };
    Sentry.captureException(error);
    return { ok: false, error: "La IA no ha podido responder. Inténtalo de nuevo." };
  }
}

export async function readStoryAction(id: string): Promise<{ ok: true; reading: StoryReading } | Fail> {
  const res = await run(id, ({ doc, ctx }) => readStory(doc, ctx));
  if (!res.ok) return res;
  if (!res.value.premise) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto una lectura esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, reading: { ...res.value, at: Date.now() } };
}

export async function suggestReferencesAction(
  id: string,
  scope: SuggestScope,
): Promise<{ ok: true; suggestions: Suggestion[] } | Fail> {
  const clean: SuggestScope =
    scope?.type === "scene" && typeof scope.sid === "string"
      ? { type: "scene", sid: scope.sid.slice(0, 40) }
      : scope?.type === "character" && typeof scope.name === "string"
        ? { type: "character", name: scope.name.slice(0, 60) }
        : { type: "script" };
  const res = await run(id, ({ doc, ctx }) => suggestReferences(doc, ctx, clean));
  if (!res.ok) return res;
  if (!res.value.length) {
    await refund(id);
    return { ok: false, error: "La IA no ha encontrado referencias esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, suggestions: res.value };
}

export async function askQuestionsAction(id: string, sid: string | null): Promise<{ ok: true; questions: Questions } | Fail> {
  const res = await run(id, ({ doc, ctx }) => askQuestions(doc, ctx, typeof sid === "string" ? sid.slice(0, 40) : null));
  if (!res.ok) return res;
  if (!res.value.items.length) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto preguntas esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, questions: { ...res.value, at: Date.now() } };
}

export async function reviewScriptAction(id: string): Promise<{ ok: true; review: Review } | Fail> {
  const res = await run(id, ({ doc, ctx }) => reviewScript(doc, ctx));
  if (!res.ok) return res;
  if (!res.value.length) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto dudas esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, review: { items: res.value, at: Date.now() } };
}

// Ideas sueltas → tres maneras de abrir la película con ellas.
export async function proposeOpeningsAction(id: string): Promise<{ ok: true; openings: OpeningProposal[] } | Fail> {
  const res = await run(id, ({ doc, ctx }) => proposeOpenings(doc, ctx));
  if (!res.ok) return res;
  if (!res.value.length) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto aperturas esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, openings: res.value };
}

// Dónde están el detonante, los giros, el punto medio y el clímax en lo escrito.
export async function findStructureAction(
  id: string,
): Promise<{ ok: true; beats: BeatProposal[]; note: string } | Fail> {
  const res = await run(id, ({ doc, ctx }) => findStructure(doc, ctx));
  if (!res.ok) return res;
  if (!res.value.beats.length) {
    await refund(id);
    return { ok: false, error: "La IA no ha encontrado la estructura esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, ...res.value };
}

// ------------------------------------------------------------------ el Compañero

// ¿Hay IA en este servidor? (el navegador no ve las claves). Sin IA, el
// Compañero hace preguntas de oficio y el resto de ayudas funcionan igual.
export async function screenplayAiStatusAction(): Promise<{ configured: boolean }> {
  return { configured: aiConfigured() };
}

// Por qué una pregunta no viene de la IA (para decirlo en la tarjeta, sin alarmar).
export type CoachNote = "no-ai" | "plan" | "limit" | "short" | "failed" | null;

type CoachOptions = { auto?: boolean; asked?: string[] };

const cleanAsked = (v: unknown) =>
  (Array.isArray(v) ? v : []).filter((q): q is string => typeof q === "string").map((q) => q.slice(0, 260)).slice(0, 12);

const SCENE_MIN_WORDS = 12;

function sceneWords(doc: Y.Doc, sid: string): number {
  const blocks = blocksFromYDoc(doc);
  const scene = scenesFromBlocks(blocks, "A4", { untitled: true }).find((s) => s.sid === sid);
  if (!scene) return 0;
  return blocks
    .slice(scene.start, scene.end)
    .filter((b) => b.type !== "note")
    .reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
}

// Decide si se puede usar la IA para el Compañero y, si no, por qué. Las
// tarjetas que salen solas (`auto`) no gastan las ayudas del día del plan
// gratuito: para ese plan usan preguntas de oficio.
async function coachSlot(
  id: string,
  loaded: Exclude<Awaited<ReturnType<typeof load>>, { error: string }>,
  focus: CoachFocus,
  auto: boolean,
): Promise<CoachNote> {
  if (!aiConfigured()) return "no-ai";
  if (focus.kind === "scene" && sceneWords(loaded.doc, focus.sid) < SCENE_MIN_WORDS) return "short";
  if (focus.kind !== "scene" && focus.text.split(/\s+/).length < 3) return "short";
  if (auto && !loaded.pro) return "plan";
  if (!(await claim(id, loaded.pro))) return "limit";
  return null;
}

function localFor(doc: Y.Doc, focus: CoachFocus, asked: string[], stuck = false): CoachQuestion {
  const blocks = blocksFromYDoc(doc);
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  return localCoachQuestion(blocks, scenes, focus.kind === "scene" ? focus.sid : null, {
    skip: asked,
    stuck,
    seed: Math.floor(Date.now() / 1000),
  });
}

// Una pregunta sobre el foco (una escena, una respuesta del arranque o una
// tarjeta del esqueleto). Siempre devuelve una pregunta: de la IA si se puede,
// si no, una de oficio, y `note` dice por qué.
export async function coachQuestionAction(
  id: string,
  rawFocus: CoachFocus,
  options: CoachOptions & { stuck?: boolean } = {},
): Promise<{ ok: true; question: CoachQuestion; note: CoachNote } | Fail> {
  const focus = cleanCoachFocus(rawFocus);
  if (!focus) return { ok: false, error: "No sé sobre qué preguntarte." };
  const loaded = await load(id);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Error" };
  const asked = cleanAsked(options.asked);
  const stuck = options.stuck === true;
  const note = await coachSlot(id, loaded, focus, options.auto === true);
  if (note) return { ok: true, question: localFor(loaded.doc, focus, asked, stuck), note };
  try {
    const q = await withMistralSlot(() => coachQuestion(loaded.doc, loaded.ctx, focus, asked));
    if (!q) {
      await refund(id);
      return { ok: true, question: localFor(loaded.doc, focus, asked, stuck), note: "failed" };
    }
    return {
      ok: true,
      question: { ...q, source: "ai", sid: focus.kind === "scene" ? focus.sid : null, at: Date.now() },
      note: null,
    };
  } catch (error) {
    await refund(id);
    if (!(error instanceof MistralBusyError)) Sentry.captureException(error);
    return { ok: true, question: localFor(loaded.doc, focus, asked, stuck), note: "failed" };
  }
}

// Al terminar una escena: ¿hace lo que su nota (o el momento marcado) decía?
// `check: null` si no hay nada con lo que compararla o no se puede usar la IA.
export async function coachSceneCheckAction(
  id: string,
  sid: string,
  options: { auto?: boolean } = {},
): Promise<{ ok: true; check: SceneCheck | null; note: CoachNote } | Fail> {
  if (typeof sid !== "string" || !sid.trim()) return { ok: false, error: "No sé de qué escena hablas." };
  const focus: CoachFocus = { kind: "scene", sid: sid.trim().slice(0, 40) };
  const loaded = await load(id);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Error" };
  // Sin pregunta guía no se compara nada (y no se gasta una ayuda).
  if (!coachSceneCheckPrompt(loaded.doc, loaded.ctx, focus.sid)) return { ok: true, check: null, note: null };
  const note = await coachSlot(id, loaded, focus, options.auto === true);
  if (note) return { ok: true, check: null, note };
  try {
    const check = await withMistralSlot(() => coachSceneCheck(loaded.doc, loaded.ctx, focus.sid));
    if (!check) await refund(id);
    return { ok: true, check, note: check ? null : "failed" };
  } catch (error) {
    await refund(id);
    if (!(error instanceof MistralBusyError)) Sentry.captureException(error);
    return { ok: true, check: null, note: "failed" };
  }
}
