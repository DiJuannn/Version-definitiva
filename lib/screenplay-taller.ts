// Puente entre un guion y su proyecto de Taller. El guion es la fuente: sus
// personajes aparecen en Personajes (con la ficha y sus imágenes) y sus
// referencias e imágenes en el Moodboard. Se reconcilia entero cada vez
// (idempotente): lo que se borra en el guion desaparece del Moodboard, y lo
// que se mueve a mano en el Moodboard conserva su sitio.

import * as Y from "yjs";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { applyMoodboardOpsCore, getMoodboard } from "@/lib/moodboard-core";
import { isProjectOwnerPro } from "@/lib/project-plan";
import type { MoodboardCard } from "@/lib/moodboard-types";
import { characterName } from "@/lib/screenplay/blocks";
import { blocksFromYDoc } from "@/lib/screenplay/ydoc";
import { characterNames, REFERENCE_KINDS, type CharacterMeta, type Reference } from "@/lib/screenplay/story";
import { storyMaps } from "@/lib/screenplay/story-doc";

export type CharacterProfile = CharacterMeta & { screenplayTitle: string };

// Prefijo de las tarjetas que pone este guion en el Moodboard.
const cardPrefix = (screenplayId: string) => `gs-${screenplayId.slice(-10)}-`;

const MOODBOARD_KIND: Partial<Record<Reference["kind"], string>> = {
  film: "Película",
  scene: "Película",
  series: "Serie",
  art: "Fotografía",
};

export function screenplayCharacters(doc: Y.Doc): { name: string; meta: CharacterMeta }[] {
  const maps = storyMaps(doc);
  const names = new Set(characterNames(blocksFromYDoc(doc)).map((c) => c.name));
  for (const key of maps.characters.keys()) names.add(characterName(key));
  return [...names].filter(Boolean).map((name) => ({ name, meta: maps.characters.get(name) ?? {} }));
}

export type SyncResult = { ok: true; characters: number; cards: number; warning?: string } | { ok: false; error: string };

export async function syncScreenplayToProjectCore(screenplayId: string, organizationId: string): Promise<SyncResult> {
  try {
    return await syncCore(screenplayId, organizationId);
  } catch (error) {
    Sentry.captureException(error);
    return { ok: false, error: "No se pudo enviar al proyecto. Se reintentará con el próximo cambio." };
  }
}

async function syncCore(screenplayId: string, organizationId: string): Promise<SyncResult> {
  const screenplay = await prisma.screenplay.findFirst({
    where: { id: screenplayId, organizationId },
    select: { id: true, title: true, ydoc: true, projectId: true },
  });
  if (!screenplay) return { ok: false, error: "Este guion ya no existe." };
  if (!screenplay.projectId) return { ok: true, characters: 0, cards: 0 };
  const project = await prisma.project.findFirst({
    where: { id: screenplay.projectId, organizationId },
    select: { id: true, organizationId: true },
  });
  if (!project) return { ok: false, error: "El proyecto vinculado ya no existe." };

  const doc = new Y.Doc();
  if (screenplay.ydoc) Y.applyUpdate(doc, new Uint8Array(screenplay.ydoc));

  // ---------------------------------------------------------- personajes
  const characters = screenplayCharacters(doc);
  const existing = await prisma.character.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((c) => [c.name.trim().toUpperCase(), c.id]));
  for (const { name, meta } of characters) {
    const profile: CharacterProfile = { ...meta, screenplayTitle: screenplay.title };
    const id = byName.get(name);
    const data = { screenplayId: screenplay.id, profile: profile as unknown as Prisma.InputJsonValue };
    if (id) await prisma.character.update({ where: { id }, data });
    else await prisma.character.create({ data: { projectId: project.id, name, ...data } });
  }

  // ---------------------------------------------------------- moodboard
  const prefix = cardPrefix(screenplay.id);
  const maps = storyMaps(doc);
  const wanted: MoodboardCard[] = [];
  for (const r of maps.refs.values()) {
    if (r.image) {
      wanted.push({ id: `${prefix}i${r.id}`.slice(0, 60), type: "image", x: 0, y: 0, w: 240, h: 200, url: r.image, caption: r.title.slice(0, 200) });
    }
    wanted.push({
      id: `${prefix}r${r.id}`.slice(0, 60),
      type: "reference",
      x: 0,
      y: 0,
      w: 260,
      h: 160,
      title: r.title,
      year: r.year ?? "",
      kind: MOODBOARD_KIND[r.kind] ?? "Otro",
      why: [r.anchor.type === "character" ? r.anchor.name : null, REFERENCE_KINDS[r.kind], r.detail].filter(Boolean).join(" · ").slice(0, 700),
    });
  }
  for (const { name, meta } of characters) {
    for (const img of meta.images ?? []) {
      wanted.push({
        id: `${prefix}c${img.id}`.slice(0, 60),
        type: "image",
        x: 0,
        y: 0,
        w: 220,
        h: 220,
        url: img.url,
        caption: `${name}${img.caption ? ` · ${img.caption}` : ""}`.slice(0, 200),
      });
    }
  }

  const pro = await isProjectOwnerPro(project.organizationId);
  const board = await getMoodboard(project.id, pro);
  const current = new Map(board.cards.map((c) => [c.id, c]));
  const wantedIds = new Set(wanted.map((c) => c.id));
  // Las nuevas, en una columna a la derecha de lo que ya haya.
  let col = 0;
  let row = 0;
  const startX = board.cards.length ? Math.max(...board.cards.map((c) => c.x + c.w)) + 80 : 0;
  const upsert = wanted.map((c) => {
    const old = current.get(c.id);
    if (old) return { ...c, x: old.x, y: old.y, w: old.w, h: old.h };
    const placed = { ...c, x: startX + col * 300, y: row * 260 };
    col = (col + 1) % 3;
    if (col === 0) row += 1;
    return placed;
  });
  const remove = board.cards.filter((c) => c.id.startsWith(prefix) && !wantedIds.has(c.id)).map((c) => c.id);
  const res = await applyMoodboardOpsCore(project.id, { upsert, remove }, pro);
  if (!res.ok) return { ok: true, characters: characters.length, cards: 0, warning: res.error };
  return { ok: true, characters: characters.length, cards: wanted.length };
}
