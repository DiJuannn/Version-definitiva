import { prisma } from "@/lib/prisma";
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

export type SaveResult =
  | { ok: true; updatedAt: string }
  | { ok: false; error: string; conflict?: boolean };

// Guarda el tablero. `baseUpdatedAt` es la versión que tenía el navegador: si
// mientras tanto otra persona guardó, no se pisa (conflict) y se le pide
// recargar. El plan gratuito no puede pasar del tope de tarjetas (lo que ya
// hubiera de cuando era PRO se respeta mientras no crezca).
export async function saveMoodboardCore(
  projectId: string,
  cardsInput: unknown,
  baseUpdatedAt: string | null,
  isPro: boolean,
): Promise<SaveResult> {
  const cards = sanitizeCards(cardsInput);
  const data: MoodboardData = { v: 1, cards };
  const json = data as unknown as Prisma.InputJsonValue;

  const current = await prisma.moodboard.findUnique({ where: { projectId } });

  if (!isPro) {
    const allowed = Math.max(MOODBOARD_FREE_CARD_LIMIT, current?.cardCount ?? 0);
    if (cards.length > allowed) {
      return {
        ok: false,
        error: `El plan gratuito permite hasta ${MOODBOARD_FREE_CARD_LIMIT} tarjetas. Pásate a PRO para tener más.`,
      };
    }
  }

  if (!current) {
    try {
      const created = await prisma.moodboard.create({ data: { projectId, data: json, cardCount: cards.length } });
      return { ok: true, updatedAt: created.updatedAt.toISOString() };
    } catch {
      // Dos pestañas crearon a la vez: la segunda ve un conflicto.
      return { ok: false, error: "El tablero se acaba de crear en otra pestaña. Recarga la página.", conflict: true };
    }
  }

  // Un tablero vacío que solo creó el contador de la IA no cuenta como cambio de otra persona.
  const justCreatedByAi = baseUpdatedAt === null && current.cardCount === 0;
  if (!justCreatedByAi && baseUpdatedAt !== current.updatedAt.toISOString()) {
    return { ok: false, error: "Otra persona ha modificado el tablero. Recarga para ver sus cambios.", conflict: true };
  }

  // Comparación atómica con la versión leída: si cambió entre medias, no actualiza.
  const result = await prisma.moodboard.updateMany({
    where: { projectId, updatedAt: current.updatedAt },
    data: { data: json, cardCount: cards.length },
  });
  if (result.count === 0) {
    return { ok: false, error: "Otra persona ha modificado el tablero. Recarga para ver sus cambios.", conflict: true };
  }
  const fresh = await prisma.moodboard.findUnique({ where: { projectId }, select: { updatedAt: true } });
  return { ok: true, updatedAt: (fresh?.updatedAt ?? new Date()).toISOString() };
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
