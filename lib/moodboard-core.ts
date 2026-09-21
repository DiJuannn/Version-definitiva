import { prisma } from "@/lib/prisma";
import { applyCardOps, type CardOps } from "@/lib/moodboard-merge";
import { canonical } from "@/lib/project-map-merge";
import type { Prisma } from "@/lib/generated/prisma";
import {
  MOODBOARD_AI_FREE_PER_PROJECT,
  MOODBOARD_AI_PRO_DAILY_LIMIT,
  MOODBOARD_FREE_CARD_LIMIT,
  MOODBOARD_MAX_CARDS,
} from "@/lib/limits";
import {
  CARD_TYPES,
  NOTE_COLORS,
  REFERENCE_KINDS,
  type CardType,
  type MoodboardCard,
  type MoodboardData,
} from "@/lib/moodboard-types";

// Moodboard: tablero libre con tarjetas. Se guarda entero como un JSON por
// proyecto (una fila). Todo lo que llega del navegador se sanea aquí: nunca
// se guarda tal cual.

const HEX = /^#[0-9a-fA-F]{6}$/;
const ID = /^[A-Za-z0-9_-]{1,60}$/;

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.slice(0, max);
  return trimmed.length > 0 ? trimmed : undefined;
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Solo imágenes por https (o del almacenamiento del propio proyecto, que también es https).
function safeUrl(value: unknown): string | undefined {
  const url = str(value, 1000);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeCards(input: unknown): MoodboardCard[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const cards: MoodboardCard[] = [];

  for (const raw of input.slice(0, MOODBOARD_MAX_CARDS)) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.id !== "string" || !ID.test(c.id) || seen.has(c.id)) continue;
    if (!(CARD_TYPES as readonly string[]).includes(c.type as string)) continue;
    const type = c.type as CardType;
    seen.add(c.id);

    const card: MoodboardCard = {
      id: c.id,
      type,
      x: num(c.x, -50000, 50000, 0),
      y: num(c.y, -50000, 50000, 0),
      w: num(c.w, 80, 1000, 240),
      h: num(c.h, 40, 1000, 140),
    };

    if (type === "note") {
      card.text = str(c.text, 2000);
      card.color = (NOTE_COLORS as readonly string[]).includes(c.color as string) ? (c.color as string) : NOTE_COLORS[0];
    } else if (type === "image") {
      card.url = safeUrl(c.url);
      if (!card.url) continue;
      card.caption = str(c.caption, 200);
    } else if (type === "palette") {
      card.title = str(c.title, 120);
      card.colors = (Array.isArray(c.colors) ? c.colors : [])
        .filter((v): v is string => typeof v === "string" && HEX.test(v))
        .slice(0, 8)
        .map((v) => v.toLowerCase());
    } else if (type === "reference") {
      card.title = str(c.title, 160);
      card.year = str(c.year, 12);
      card.kind = (REFERENCE_KINDS as readonly string[]).includes(c.kind as string) ? (c.kind as string) : "Otro";
      card.why = str(c.why, 700);
    } else {
      card.refId = str(c.refId, 60);
      card.label = str(c.label, 160);
    }
    cards.push(card);
  }
  return cards;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Contador de sugerencias de IA sin columnas nuevas: en el plan gratuito aiDay vale
// FREE_AI_KEY y aiCount cuenta las usadas en total; en PRO aiDay es la fecha y
// aiCount las de ese día. Quien baja de PRO a gratis con alguna sugerencia ya
// hecha cuenta como que gastó la gratuita.
const FREE_AI_KEY = "free";

function aiUsage(board: { aiDay: string | null; aiCount: number } | null, isPro: boolean): number {
  if (!board || !board.aiDay) return 0;
  if (isPro) return board.aiDay === todayKey() ? board.aiCount : 0;
  return board.aiDay === FREE_AI_KEY ? board.aiCount : MOODBOARD_AI_FREE_PER_PROJECT;
}

export async function getMoodboard(projectId: string, isPro = false) {
  const board = await prisma.moodboard.findUnique({ where: { projectId } });
  if (!board) return { cards: [] as MoodboardCard[], updatedAt: null as string | null, aiUsed: 0 };
  const data = board.data as unknown as MoodboardData;
  return {
    cards: sanitizeCards(data?.cards),
    updatedAt: board.updatedAt.toISOString(),
    aiUsed: aiUsage(board, isPro),
  };
}

export type SaveResult = { ok: true; cards: MoodboardCard[]; updatedAt: string } | { ok: false; error: string };

// Aplica los CAMBIOS de una persona (tarjetas nuevas, cambiadas o quitadas) sobre la versión más
// reciente, con la fila bloqueada para que dos guardados a la vez se apliquen uno tras otro. Devuelve
// el tablero resultante (con lo de los demás incluido). El plan gratuito no puede pasar del tope de
// tarjetas (lo que ya hubiera de cuando era PRO se respeta mientras no crezca).
export async function applyMoodboardOpsCore(projectId: string, ops: unknown, isPro: boolean): Promise<SaveResult> {
  const safeOps = (ops && typeof ops === "object" ? ops : {}) as CardOps;

  // La fila puede no existir aún (primer guardado): se crea de forma segura ante dos a la vez.
  await prisma.moodboard.upsert({
    where: { projectId },
    create: { projectId, data: { v: 1, cards: [] } as unknown as Prisma.InputJsonValue, cardCount: 0 },
    update: {},
  });

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Moodboard" WHERE "projectId" = ${projectId} FOR UPDATE`;
      const row = await tx.moodboard.findUniqueOrThrow({ where: { projectId } });
      const current = sanitizeCards((row.data as unknown as MoodboardData)?.cards);
      const next = sanitizeCards(applyCardOps(current, safeOps));

      if (!isPro && next.length > Math.max(MOODBOARD_FREE_CARD_LIMIT, current.length)) {
        return {
          ok: false as const,
          error: `El plan gratuito permite hasta ${MOODBOARD_FREE_CARD_LIMIT} tarjetas. Pásate a PRO para tener más.`,
        };
      }
      if (canonical(next) === canonical(current)) {
        return { ok: true as const, cards: next, updatedAt: row.updatedAt.toISOString() };
      }
      const data: MoodboardData = { v: 1, cards: next };
      const updated = await tx.moodboard.update({
        where: { projectId },
        data: { data: data as unknown as Prisma.InputJsonValue, cardCount: next.length },
      });
      return { ok: true as const, cards: next, updatedAt: updated.updatedAt.toISOString() };
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
}

// Versión actual del tablero (barata): para saber si alguien ha cambiado algo.
export async function getMoodboardVersion(projectId: string): Promise<string | null> {
  const row = await prisma.moodboard.findUnique({ where: { projectId }, select: { updatedAt: true } });
  return row ? row.updatedAt.toISOString() : null;
}

export type AiClaim = { ok: true } | { ok: false; reason: "free" | "daily" };

// Cuenta una sugerencia de IA. Gratis: 1 por proyecto en total. PRO: hasta el
// tope diario por proyecto.
export async function claimMoodboardAiUse(projectId: string, isPro: boolean): Promise<AiClaim> {
  const board = await prisma.moodboard.findUnique({ where: { projectId } });
  const used = aiUsage(board, isPro);
  const limit = isPro ? MOODBOARD_AI_PRO_DAILY_LIMIT : MOODBOARD_AI_FREE_PER_PROJECT;
  if (used >= limit) return { ok: false, reason: isPro ? "daily" : "free" };

  const key = isPro ? todayKey() : FREE_AI_KEY;
  if (!board) {
    await prisma.moodboard.create({
      data: { projectId, data: { v: 1, cards: [] } as unknown as Prisma.InputJsonValue, aiDay: key, aiCount: 1 },
    });
    return { ok: true };
  }

  // Se cuenta sin tocar updatedAt de las tarjetas para no provocar conflictos falsos.
  await prisma.$executeRaw`UPDATE "Moodboard" SET "aiDay" = ${key}, "aiCount" = ${used + 1} WHERE "id" = ${board.id}`;
  return { ok: true };
}

// Devuelve el uso si la IA falló o no dio nada: que un error no gaste la única
// sugerencia gratuita ni una de las diarias.
export async function refundMoodboardAiUse(projectId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "Moodboard" SET "aiCount" = GREATEST("aiCount" - 1, 0) WHERE "projectId" = ${projectId}`;
}
