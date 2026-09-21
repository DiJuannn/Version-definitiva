import { prisma } from "@/lib/prisma";
import type { SearchHit } from "@/lib/search-hits";
import { normalize } from "@/lib/tool-search";

// Búsqueda dentro de un proyecto (escenas, personajes, sitios, tareas…). Compartida por la Server Action
// de la web y la ruta de la app. La comprobación de acceso al proyecto la hace quien llama.
//
// Se filtra en memoria (sin mayúsculas ni acentos: «lucia» encuentra «Lucía»): la base de datos no compara
// sin acentos y un proyecto tiene decenas o pocos cientos de filas por tipo, así que sale barato.

const PER_KIND = 5;
const MAX_ROWS = 1000;

export async function searchProjectContent(
  projectId: string,
  organizationId: string,
  rawQuery: string,
): Promise<SearchHit[]> {
  const q = normalize(rawQuery.slice(0, 60));
  if (q.length < 2) return [];
  const has = (...texts: (string | null | undefined)[]) => texts.some((t) => t && normalize(t).includes(q));

  const [scenes, characters, actors, locations, tasks, elements, items] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      take: MAX_ROWS,
      select: {
        id: true,
        number: true,
        description: true,
        action: true,
        dialogueNotes: true,
        productionNotes: true,
        location: { select: { name: true } },
      },
    }),
    prisma.character.findMany({
      where: { projectId },
      take: MAX_ROWS,
      select: { id: true, name: true, notes: true, actor: { select: { name: true } } },
    }),
    prisma.actor.findMany({ where: { projectId }, take: MAX_ROWS, select: { id: true, name: true } }),
    prisma.location.findMany({ where: { organizationId }, take: MAX_ROWS, select: { id: true, name: true, address: true } }),
    prisma.task.findMany({
      where: { projectId },
      take: MAX_ROWS,
      select: { id: true, title: true, description: true, status: true },
    }),
    prisma.breakdownElement.findMany({ where: { projectId }, take: MAX_ROWS, select: { id: true, name: true, notes: true } }),
    prisma.budgetItem.findMany({
      where: { category: { projectId } },
      take: MAX_ROWS,
      select: { id: true, description: true, category: { select: { name: true } } },
    }),
  ]);

  return [
    ...scenes
      .filter((s) => has(s.number, s.description, s.action, s.dialogueNotes, s.productionNotes, s.location?.name))
      .slice(0, PER_KIND)
      .map((s) => ({
        kind: "scene" as const,
        id: s.id,
        title: `Escena ${s.number}`,
        subtitle: [s.location?.name, s.description].filter(Boolean).join(" · ") || null,
      })),
    ...characters
      .filter((c) => has(c.name, c.notes))
      .slice(0, PER_KIND)
      .map((c) => ({
        kind: "character" as const,
        id: c.id,
        title: c.name,
        subtitle: c.actor ? `Lo interpreta ${c.actor.name}` : "Sin actor asignado",
      })),
    ...actors
      .filter((a) => has(a.name))
      .slice(0, PER_KIND)
      .map((a) => ({ kind: "actor" as const, id: a.id, title: a.name, subtitle: "Actor o actriz" })),
    ...locations
      .filter((l) => has(l.name, l.address))
      .slice(0, PER_KIND)
      .map((l) => ({ kind: "location" as const, id: l.id, title: l.name, subtitle: l.address })),
    ...tasks
      .filter((t) => has(t.title, t.description))
      .slice(0, PER_KIND)
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        title: t.title,
        subtitle: t.status === "DONE" ? "Hecha" : "Pendiente",
      })),
    ...elements
      .filter((e) => has(e.name, e.notes))
      .slice(0, PER_KIND)
      .map((e) => ({ kind: "breakdown" as const, id: e.id, title: e.name, subtitle: "Desglose" })),
    ...items
      .filter((i) => has(i.description))
      .slice(0, PER_KIND)
      .map((i) => ({
        kind: "budget" as const,
        id: i.id,
        title: i.description,
        subtitle: `Presupuesto · ${i.category.name}`,
      })),
  ];
}
