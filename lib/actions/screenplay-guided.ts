"use server";

import * as Y from "yjs";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { isPro } from "@/lib/plan";
import { MistralBusyError, withMistralSlot } from "@/lib/mistral-concurrency";
import { SCREENPLAY_AI_FREE_DAILY_LIMIT, SCREENPLAY_AI_PRO_DAILY_LIMIT } from "@/lib/limits";
import { SCREENPLAY_FORMAT_LABELS, createScreenplayCore, parseFormat } from "@/lib/screenplay-core";
import { aiConfigured } from "@/lib/screenplay-ai";
import { createScreenplay, type CreateScreenplayState } from "@/lib/actions/screenplays";
import {
  cleanAnswers,
  coachQuestion,
  polishLogline,
  tailorQuestions,
  type CoachFocus,
  type GuidedContext,
} from "@/lib/screenplay-guided-ai";

// ------------------------------------------------------------------ crear

const UNTITLED = "Sin título";

// «Nuevo guion» en un solo campo: el título (opcional) y cómo se empieza.
// «Guíame» marca el guion como guiado y abre las 5 preguntas; «Ya sé lo que
// hago» va directo a la página en blanco. Importar sigue igual.
export async function createScreenplayStart(prev: CreateScreenplayState, formData: FormData): Promise<CreateScreenplayState> {
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) return createScreenplay(prev, formData);

  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo crear el guion." };
  const guided = formData.get("mode") !== "blank";
  const title = String(formData.get("title") ?? "").trim() || UNTITLED;

  const result = await createScreenplayCore(profile.organizationId, profile.id, {
    title,
    format: parseFormat(formData.get("format")),
    logline: optionalString(formData.get("logline")),
    author: optionalString(formData.get("author")) ?? profile.fullName,
  });
  if ("error" in result) return result;

  if (guided) {
    // El guion nace sabiendo que es guiado (en el documento, sin columnas nuevas).
    const row = await prisma.screenplay.findUnique({ where: { id: result.id }, select: { ydoc: true } });
    const doc = new Y.Doc();
    if (row?.ydoc) Y.applyUpdate(doc, new Uint8Array(row.ydoc));
    doc.getMap<unknown>("structure").set("guided", true);
    await prisma.screenplay.update({ where: { id: result.id }, data: { ydoc: Buffer.from(Y.encodeStateAsUpdate(doc)) } });
  }

  revalidatePath("/app/guiones");
  redirect(`/app/guiones/${result.id}?paso=${guided ? "empezar" : "guion"}`);
}

// ------------------------------------------------------------------ IA (opcional)

type Fail = { ok: false; error: string; upgrade?: boolean };

export async function guidedAiStatus(): Promise<{ available: boolean }> {
  const profile = await getCurrentProfile();
  return { available: Boolean(profile) && aiConfigured() };
}

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

// Mismo cupo diario que el resto de ayudas de IA del guion.
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

// Aquí no hace falta texto de guion: basta con lo que se ha contestado.
async function run<T>(id: string, enough: boolean, fn: (ctx: GuidedContext) => Promise<T>): Promise<{ ok: true; value: T } | Fail> {
  if (!aiConfigured()) return { ok: false, error: "La IA no está configurada en este servidor." };
  if (!enough) return { ok: false, error: "Escribe un poco más (unas pocas palabras bastan) y vuelve a probar." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };
  const screenplay = await prisma.screenplay.findFirst({
    where: { id: String(id).slice(0, 40), organizationId: profile.organizationId },
    select: { id: true, title: true, format: true },
  });
  if (!screenplay) return { ok: false, error: "Este guion ya no existe." };
  const pro = isPro(profile.organization.plan);
  if (!(await claim(screenplay.id, pro))) {
    return pro
      ? { ok: false, error: `Has usado las ${SCREENPLAY_AI_PRO_DAILY_LIMIT} ayudas de IA de hoy en este guion. Mañana tendrás más.` }
      : {
          ok: false,
          upgrade: true,
          error: `Has usado las ${SCREENPLAY_AI_FREE_DAILY_LIMIT} ayudas de IA de hoy en este guion. Con PRO tienes hasta ${SCREENPLAY_AI_PRO_DAILY_LIMIT} al día.`,
        };
  }
  try {
    return {
      ok: true,
      value: await withMistralSlot(() => fn({ title: screenplay.title, format: SCREENPLAY_FORMAT_LABELS[screenplay.format] })),
    };
  } catch (error) {
    await refund(screenplay.id);
    if (error instanceof MistralBusyError) return { ok: false, error: "La IA está muy ocupada ahora mismo. Prueba en un minuto." };
    Sentry.captureException(error);
    return { ok: false, error: "La IA no ha podido responder. Inténtalo de nuevo." };
  }
}

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanFocus(v: unknown): CoachFocus | null {
  const f = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  if (f.kind === "answer") return { kind: "answer", question: str(f.question, 200), text: str(f.text, 600) };
  if (f.kind === "card") return { kind: "card", title: str(f.title, 120), question: str(f.question, 240), text: str(f.text, 600) };
  return null;
}

// «Una pregunta, no una respuesta».
export async function guidedCoachAction(id: string, answers: unknown, focus: unknown): Promise<{ ok: true; question: string; why: string } | Fail> {
  const a = cleanAnswers(answers);
  const f = cleanFocus(focus);
  if (!f) return { ok: false, error: "No hay nada sobre lo que preguntar." };
  const enough = f.kind === "answer" ? words(f.text) >= 3 : words(f.text) + words(a.want ?? "") + words(a.idea ?? "") >= 3;
  const res = await run(id, enough, (ctx) => coachQuestion(ctx, a, f));
  if (!res.ok) return res;
  if (!res.value.question) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto ninguna pregunta esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, ...res.value };
}

// La frase de la historia más clara, con las mismas palabras: se propone y
// quien escribe elige.
export async function guidedLoglineAction(id: string, answers: unknown, current: unknown): Promise<{ ok: true; logline: string } | Fail> {
  const a = cleanAnswers(answers);
  const res = await run(id, words([a.idea, a.want, a.obstacle].join(" ")) >= 4, (ctx) => polishLogline(ctx, a, str(current, 400)));
  if (!res.ok) return res;
  if (!res.value) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto ninguna frase esta vez. Inténtalo de nuevo." };
  }
  return { ok: true, logline: res.value };
}

// Las preguntas guía de las tarjetas, para esta historia.
export async function guidedTailorAction(id: string, answers: unknown, steps: unknown): Promise<{ ok: true; questions: string[] } | Fail> {
  const a = cleanAnswers(answers);
  const list = (Array.isArray(steps) ? steps : [])
    .slice(0, 16)
    .map((x) => ({ title: str((x as Record<string, unknown>)?.title, 120), question: str((x as Record<string, unknown>)?.question, 240) }))
    .filter((x) => x.question);
  if (!list.length) return { ok: false, error: "No hay tarjetas." };
  const res = await run(id, words([a.idea, a.want, a.name].join(" ")) >= 3, (ctx) => tailorQuestions(ctx, a, list));
  if (!res.ok) return res;
  if (!res.value.length) {
    await refund(id);
    return { ok: false, error: "La IA no ha devuelto preguntas para todas las tarjetas. Se quedan las de siempre." };
  }
  return { ok: true, questions: res.value };
}
