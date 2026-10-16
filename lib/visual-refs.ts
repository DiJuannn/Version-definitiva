// Las referencias del moodboard fuera del moodboard: lo que cada escena,
// personaje o localización tiene marcado «para» ella, y la paleta de la
// película (las paletas y los colores de las fotos). Lo usan la Biblia visual,
// la ficha de escena, Planos, el Desglose y Personajes.

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { sanitizeCards } from "@/lib/moodboard-core";
import type { Facet, MoodboardCard } from "@/lib/moodboard-types";

export type VisualRef = Pick<
  MoodboardCard,
  "id" | "type" | "url" | "caption" | "title" | "year" | "kind" | "why" | "text" | "colors" | "facets" | "scenes" | "characters" | "locations"
>;

const TAGGABLE = new Set(["note", "image", "palette", "reference"]);

export const getVisualRefs = cache(async function getVisualRefs(projectId: string): Promise<VisualRef[]> {
  const board = await prisma.moodboard.findUnique({ where: { projectId }, select: { data: true } });
  const cards = sanitizeCards((board?.data as { cards?: unknown } | null)?.cards);
  return cards
    .filter((c) => TAGGABLE.has(c.type))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(({ id, type, url, caption, title, year, kind, why, text, colors, facets, scenes, characters, locations }) => ({
      id, type, url, caption, title, year, kind, why, text, colors, facets, scenes, characters, locations,
    }));
});

// Las de una escena (o personaje, o lugar); si se pasan facetas, primero las
// que las tienen. Las notas sin texto y las paletas vacías no cuentan.
export function refsFor(
  refs: VisualRef[],
  target: { sceneId?: string; characterId?: string; locationId?: string },
  prefer: Facet[] = [],
): VisualRef[] {
  const hit = refs.filter(
    (r) =>
      (target.sceneId && r.scenes?.includes(target.sceneId)) ||
      (target.characterId && r.characters?.includes(target.characterId)) ||
      (target.locationId && r.locations?.includes(target.locationId)),
  );
  const score = (r: VisualRef) => (r.facets?.some((f) => prefer.includes(f)) ? 0 : 1);
  return hit.filter((r) => (r.type === "note" ? r.text?.trim() : true)).sort((a, b) => score(a) - score(b));
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// La paleta de la película: primero las paletas hechas a mano, luego los
// colores de las fotos, sin repetir tonos casi iguales.
export function filmPalette(refs: VisualRef[], max = 10): string[] {
  const pool = [...refs.filter((r) => r.type === "palette"), ...refs.filter((r) => r.type === "image")].flatMap((r) => r.colors ?? []);
  const out: string[] = [];
  for (const c of pool) {
    const [r, g, b] = rgb(c);
    if (out.every((o) => {
      const [r2, g2, b2] = rgb(o);
      return Math.hypot(r - r2, g - g2, b - b2) > 48;
    }))
      out.push(c);
    if (out.length >= max) break;
  }
  return out;
}
