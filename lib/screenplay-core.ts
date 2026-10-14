import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { Prisma, type ScreenplayFormat } from "@/lib/generated/prisma";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import { parseFountain } from "@/lib/screenplay/fountain";
import { screenplayStats } from "@/lib/screenplay/layout";
import { blocksFromYDoc, fillYDoc, fromBase64, toBase64 } from "@/lib/screenplay/ydoc";

export const SCREENPLAY_FORMAT_LABELS: Record<ScreenplayFormat, string> = {
  SHORT: "Cortometraje",
  FEATURE: "Largometraje",
  SERIES_EPISODE: "Episodio de serie",
  OTHER: "Otro",
};

export const SCREENPLAY_TITLE_MAX = 120;
export const SCREENPLAY_LOGLINE_MAX = 400;
// Un largo de 120 páginas en Fountain ronda los 150-250 KB. Por debajo del
// límite de 1 MB de las Server Actions.
export const FOUNTAIN_MAX_BYTES = 900 * 1024;
// Un guardado trae solo lo nuevo desde el último guardado: normalmente unos
// pocos KB. El tope evita que alguien llene la base de datos de golpe.
export const UPDATE_MAX_BYTES = 700 * 1024;

// "DISTORSIÓN" → "Distorsión" (las portadas suelen ir en mayúsculas).
function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

export function parseFormat(v: unknown): ScreenplayFormat {
  return v === "FEATURE" || v === "SERIES_EPISODE" || v === "OTHER" ? v : "SHORT";
}

export function listScreenplays(organizationId: string) {
  return prisma.screenplay.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      format: true,
      logline: true,
      pageCount: true,
      sceneCount: true,
      wordCount: true,
      updatedAt: true,
      createdBy: { select: { fullName: true, email: true } },
    },
  });
}

export function getScreenplay(organizationId: string, id: string) {
  return prisma.screenplay.findFirst({ where: { id, organizationId } });
}

export type CreateScreenplayInput = {
  title: string;
  format: ScreenplayFormat;
  logline: string | null;
  author: string | null;
  fountain?: string | null;
  // Guion ya leído de otro formato (PDF).
  imported?: { title: string | null; author?: string | null; blocks: ScreenplayBlock[] } | null;
};

export async function createScreenplayCore(
  organizationId: string,
  userId: string,
  input: CreateScreenplayInput,
): Promise<{ id: string } | { error: string }> {
  let title = input.title.trim().slice(0, SCREENPLAY_TITLE_MAX);
  let author = input.author?.trim() || null;
  let blocks: ScreenplayBlock[] = [];

  if (input.imported) {
    blocks = input.imported.blocks;
    if (!title && input.imported.title) title = titleCase(input.imported.title).slice(0, SCREENPLAY_TITLE_MAX);
    if (!author && input.imported.author) author = input.imported.author;
    if (!blocks.length) return { error: "No se ha encontrado texto de guion en el PDF (¿es un escaneo?)." };
  } else if (input.fountain) {
    const parsed = parseFountain(input.fountain);
    blocks = parsed.blocks;
    if (!title && parsed.titlePage.title) title = parsed.titlePage.title.split("\n")[0].slice(0, SCREENPLAY_TITLE_MAX);
    if (!author && parsed.titlePage.author) author = parsed.titlePage.author.split("\n")[0];
    if (!blocks.length) return { error: "No se ha encontrado ningún texto de guion en el archivo." };
  }
  if (!title) return { error: "Ponle un título al guion." };

  // Un guion nunca nace vacío: así dos personas que lo abren a la vez por
  // primera vez no crean cada una su primer bloque (se duplicaría).
  if (!blocks.length) blocks = [{ type: "sceneHeading", text: "" }];

  const stats = screenplayStats(blocks);
  const logline = input.logline?.trim().slice(0, SCREENPLAY_LOGLINE_MAX) || null;
  const doc = new Y.Doc();
  fillYDoc(doc, blocks);
  if (logline) doc.getMap<string>("dev").set("logline", logline);
  const screenplay = await prisma.screenplay.create({
    data: {
      organizationId,
      createdById: userId,
      title,
      format: input.format,
      logline,
      author,
      ydoc: Buffer.from(Y.encodeStateAsUpdate(doc)),
      content: blocks as unknown as Prisma.InputJsonValue,
      pageCount: stats.pages,
      sceneCount: stats.scenes,
      wordCount: stats.words,
    },
    select: { id: true },
  });
  return { id: screenplay.id };
}

export type SaveScreenplayResult =
  | { ok: true; stateVector: string; pageCount: number; sceneCount: number; savedAt: string }
  | { ok: false; error: string };

// Fusiona en el servidor lo que manda un navegador con lo que ya está
// guardado. Se bloquea la fila mientras tanto (FOR UPDATE): si dos personas
// guardan a la vez, la segunda espera a la primera y fusiona sobre su
// resultado, en vez de leer el mismo estado viejo y pisarla.
export async function applyScreenplayUpdateCore(
  organizationId: string,
  id: string,
  updateBase64: string,
): Promise<SaveScreenplayResult> {
  if (typeof updateBase64 !== "string") return { ok: false, error: "Cambios no válidos." };
  const update = fromBase64(updateBase64);
  if (update.byteLength > UPDATE_MAX_BYTES) return { ok: false, error: "Demasiados cambios de una vez." };

  try {
    return await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ ydoc: Buffer | null }[]>`
          SELECT "ydoc" FROM "Screenplay"
          WHERE "id" = ${id} AND "organizationId" = ${organizationId}
          FOR UPDATE`;
        if (!rows.length) return { ok: false as const, error: "Este guion ya no existe." };

        const doc = new Y.Doc();
        if (rows[0].ydoc) Y.applyUpdate(doc, new Uint8Array(rows[0].ydoc));
        if (update.byteLength) Y.applyUpdate(doc, update);

        const blocks = blocksFromYDoc(doc);
        const stats = screenplayStats(blocks);
        // La logline se escribe en el paso "Idea"; la lista de guiones la enseña.
        const logline = doc.getMap<string>("dev").get("logline");
        const saved = await tx.screenplay.update({
          where: { id },
          data: {
            ...(typeof logline === "string" ? { logline: logline.trim().slice(0, SCREENPLAY_LOGLINE_MAX) || null } : {}),
            ydoc: Buffer.from(Y.encodeStateAsUpdate(doc)),
            content: blocks as unknown as Prisma.InputJsonValue,
            pageCount: stats.pages,
            sceneCount: stats.scenes,
            wordCount: stats.words,
          },
          select: { updatedAt: true },
        });
        return {
          ok: true as const,
          stateVector: toBase64(Y.encodeStateVector(doc)),
          pageCount: stats.pages,
          sceneCount: stats.scenes,
          savedAt: saved.updatedAt.toISOString(),
        };
      },
      { timeout: 15_000 },
    );
  } catch {
    return { ok: false, error: "No se pudo guardar. Se reintentará solo." };
  }
}

export function screenplayBlocks(content: Prisma.JsonValue | null): ScreenplayBlock[] {
  return Array.isArray(content) ? (content as unknown as ScreenplayBlock[]) : [];
}
