import { prisma } from "@/lib/prisma";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { MoodboardLookup } from "@/lib/moodboard-types";

// Lo que el moodboard necesita saber del proyecto para pintar las tarjetas vivas (escenas, personajes y
// localizaciones). Lo usan la página del moodboard de la web y la ruta de la app.
export async function getMoodboardLookup(projectId: string): Promise<MoodboardLookup> {
  const [scenes, characters] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        description: true,
        location: { select: { id: true, name: true, address: true } },
      },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, actor: { select: { name: true } } },
    }),
  ]);

  const locations = new Map<string, { id: string; name: string; address: string | null }>();
  for (const s of scenes) if (s.location) locations.set(s.location.id, s.location);

  return {
    scenes: scenes.map((s) => ({
      id: s.id,
      number: s.number,
      heading: `${INT_EXT_LABELS[s.intExt]} · ${DAY_PART_LABELS[s.dayPart]}`,
      location: s.location?.name ?? null,
      description: s.description ? s.description.slice(0, 160) : null,
    })),
    characters: characters.map((c) => ({ id: c.id, name: c.name, actor: c.actor?.name ?? null })),
    locations: [...locations.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
  };
}
