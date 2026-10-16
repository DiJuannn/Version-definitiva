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
import { characterNames, scenesFromBlocks, REFERENCE_KINDS, type CharacterMeta, type Reference } from "@/lib/screenplay/story";
import { storyMaps } from "@/lib/screenplay/story-doc";

export type CharacterProfile = CharacterMeta & { screenplayTitle: string; sceneCount?: number };

// Prefijo de las tarjetas que pone este guion en el Moodboard.
const cardPrefix = (screenplayId: string) => `gs-${screenplayId.slice(-10)}-`;

const MOODBOARD_KIND: Partial<Record<Reference["kind"], string>> = {
  film: "Película",
  scene: "Película",
  series: "Serie",
  art: "Fotografía",
};

export function screenplayCharacters(doc: Y.Doc): { name: string; meta: CharacterMeta; scenes: number }[] {
  const maps = storyMaps(doc);
  const blocks = blocksFromYDoc(doc);
  const scenes = scenesFromBlocks(blocks);
  const names = new Set(characterNames(blocks).map((c) => c.name));
  for (const key of maps.characters.keys()) names.add(characterName(key));
  return [...names]
    .filter(Boolean)
    .map((name) => ({ name, meta: maps.characters.get(name) ?? {}, scenes: scenes.filter((s) => s.present.includes(name)).length }));
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
  // Con el candado del proyecto: si dos personas guardan a la vez, el
  // segundo ve los personajes que creó el primero y no los duplica.
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`character-sync:${project.id}`}))`;
      const existing = await tx.character.findMany({
        where: { projectId: project.id },
        select: { id: true, name: true },
      });
      const byName = new Map(existing.map((c) => [c.name.trim().toUpperCase(), c.id]));
      for (const { name, meta, scenes } of characters) {
        const profile: CharacterProfile = { ...meta, screenplayTitle: screenplay.title, sceneCount: scenes };
        const id = byName.get(name);
        const data = { screenplayId: screenplay.id, profile: profile as unknown as Prisma.InputJsonValue };
        if (id) await tx.character.update({ where: { id }, data });
        else await tx.character.create({ data: { projectId: project.id, name, ...data } });
      }
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  // ---------------------------------------------------------- moodboard
  // Cada referencia va al Moodboard agrupada como en el guion: una columna por
  // escena (con la tarjeta viva de la escena arriba), una por personaje y una
  // para las del guion entero. Las tarjetas que ya estaban no se mueven.
  const prefix = cardPrefix(screenplay.id);
  const maps = storyMaps(doc);
  const [prodScenes, prodCharacters] = await Promise.all([
    prisma.scene.findMany({ where: { projectId: project.id, scriptSid: { not: null } }, select: { id: true, number: true, scriptSid: true } }),
    prisma.character.findMany({ where: { projectId: project.id }, select: { id: true, name: true } }),
  ]);
  const sceneBySid = new Map(prodScenes.map((sc) => [sc.scriptSid as string, sc]));
  const characterByName = new Map(prodCharacters.map((c) => [c.name.trim().toUpperCase(), c]));

  // `link`: para qué es cada tarjeta de la columna (su escena o su personaje).
  type Group = { key: string; order: number; head?: MoodboardCard; cards: MoodboardCard[]; link: Partial<MoodboardCard> };
  const groups = new Map<string, Group>();
  const group = (key: string, order: number, head?: MoodboardCard, link: Partial<MoodboardCard> = {}) => {
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { key, order, head, cards: [], link }));
    return g;
  };
  const sceneOrder = (n: string) => Number.parseFloat(n) || 0;
  const groupFor = (anchor: Reference["anchor"]): Group => {
    if (anchor.type === "scene") {
      const sc = sceneBySid.get(anchor.sid);
      if (sc)
        return group(`s${anchor.sid}`, 1000 + sceneOrder(sc.number), {
          id: `${prefix}s${anchor.sid}`.slice(0, 60), type: "scene", x: 0, y: 0, w: 260, h: 120, refId: sc.id, label: sc.number,
        }, { scenes: [sc.id] });
    }
    if (anchor.type === "character") {
      const ch = characterByName.get(anchor.name.trim().toUpperCase());
      if (ch)
        return group(`c${ch.name.toUpperCase()}`, 500, {
          id: `${prefix}h${ch.id}`.slice(0, 60), type: "character", x: 0, y: 0, w: 240, h: 110, refId: ch.id, label: ch.name,
        }, { characters: [ch.id] });
    }
    return group("script", 0);
  };

  for (const r of maps.refs.values()) {
    const g = groupFor(r.anchor);
    if (r.image) {
      g.cards.push({ id: `${prefix}i${r.id}`.slice(0, 60), type: "image", x: 0, y: 0, w: 240, h: 200, url: r.image, caption: r.title.slice(0, 200), ...g.link });
    }
    g.cards.push({
      id: `${prefix}r${r.id}`.slice(0, 60),
      type: "reference",
      x: 0,
      y: 0,
      w: 260,
      h: 160,
      title: r.title,
      year: r.year ?? "",
      kind: MOODBOARD_KIND[r.kind] ?? "Otro",
      why: [r.author, REFERENCE_KINDS[r.kind], r.detail, r.url].filter(Boolean).join(" · ").slice(0, 700),
      ...g.link,
    });
  }
  for (const { name, meta } of characters) {
    if (!meta.images?.length) continue;
    const g = groupFor({ type: "character", name });
    for (const img of meta.images) {
      g.cards.push({
        id: `${prefix}c${img.id}`.slice(0, 60),
        type: "image",
        x: 0,
        y: 0,
        w: 220,
        h: 220,
        url: img.url,
        caption: `${name}${img.caption ? ` · ${img.caption}` : ""}`.slice(0, 200),
        facets: ["vestuario"],
        ...g.link,
      });
    }
  }

  const pro = await isProjectOwnerPro(project.organizationId);
  const board = await getMoodboard(project.id, pro);
  const current = new Map(board.cards.map((c) => [c.id, c]));
  const ordered = [...groups.values()].sort((a, b) => a.order - b.order);
  // Si en el tablero ya hay a mano una tarjeta de esa escena o personaje, la
  // columna se cuelga de ella en vez de duplicarla.
  const twins = new Map<string, MoodboardCard>();
  for (const g of ordered) {
    const head = g.head;
    if (!head || current.has(head.id)) continue;
    const twin = board.cards.find((c) => c.type === head.type && c.refId === head.refId);
    if (twin) {
      twins.set(g.key, twin);
      g.head = undefined;
    }
  }
  const wanted: MoodboardCard[] = ordered.flatMap((g) => (g.head ? [g.head, ...g.cards] : g.cards));
  const wantedIds = new Set(wanted.map((c) => c.id));

  // Las columnas nuevas, a la derecha de lo que ya haya; dentro de una
  // columna que ya existe, las tarjetas nuevas debajo de la última.
  let nextColumnX = board.cards.length ? Math.max(...board.cards.map((c) => c.x + c.w)) + 80 : 0;
  const upsert: MoodboardCard[] = [];
  for (const g of ordered) {
    const members = g.head ? [g.head, ...g.cards] : g.cards;
    const placed = members.map((c) => current.get(c.id)).filter((c): c is MoodboardCard => Boolean(c));
    const twin = twins.get(g.key);
    if (twin) placed.unshift(twin);
    let x: number;
    let y: number;
    if (placed.length) {
      x = placed[0].x;
      y = Math.max(...placed.map((c) => c.y + c.h)) + 30;
    } else {
      x = nextColumnX;
      y = 0;
      nextColumnX += 320;
    }
    for (const c of members) {
      const old = current.get(c.id);
      // La cabecera (escena o personaje) que llega tarde va encima de su columna.
      if (!old && c === g.head && placed.length) {
        upsert.push({ ...c, x, y: Math.min(...placed.map((p) => p.y)) - c.h - 30 });
        continue;
      }
      if (old) {
        // Lo que se le haya puesto a mano en el moodboard (qué define, para
        // qué es, sus colores) se respeta: el guion solo añade su escena.
        const union = (a?: string[], b?: string[]) => (a?.length || b?.length ? [...new Set([...(b ?? []), ...(a ?? [])])] : undefined);
        upsert.push({
          ...c,
          x: old.x,
          y: old.y,
          w: old.w,
          h: old.h,
          facets: old.facets ?? c.facets,
          colors: old.colors ?? c.colors,
          scenes: union(c.scenes, old.scenes),
          characters: union(c.characters, old.characters),
          locations: old.locations,
        });
      } else {
        upsert.push({ ...c, x, y });
        y += c.h + 30;
      }
    }
  }
  const remove = board.cards.filter((c) => c.id.startsWith(prefix) && !wantedIds.has(c.id)).map((c) => c.id);
  const res = await applyMoodboardOpsCore(project.id, { upsert, remove }, pro);
  if (!res.ok) return { ok: true, characters: characters.length, cards: 0, warning: res.error };
  return { ok: true, characters: characters.length, cards: wanted.length };
}
