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
  askQuestions,
  hasEnoughText,
  readStory,
  suggestReferences,
  type SuggestScope,
} from "@/lib/screenplay-ai";
import type { Questions, StoryReading, Suggestion } from "@/lib/screenplay/story";

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
  if (!process.env.MISTRAL_API_KEY) return { ok: false, error: "La IA no está configurada en este servidor." };
  const loaded = await load(id);
  if ("error" in loaded) return { ok: false, error: loaded.error ?? "Error" };
  if (!hasEnoughText(loaded.doc)) {
    return { ok: false, error: "Todavía hay muy poco escrito. Escribe al menos una escena y vuelve a probar." };
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
