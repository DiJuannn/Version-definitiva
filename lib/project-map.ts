import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { buildProjectHighlights, getProjectSummary } from "@/lib/project-summary";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import {
  MAP_MAX_NOTES,
  MAP_TOOL_KEYS,
  MAP_TOOL_SIZE,
  NOTE_COLORS,
  type MapLayout,
  type MapNote,
  type MapRect,
  type MapToolCard,
  type MapToolKey,
} from "@/lib/project-map-types";

// Mapa del proyecto: una tarjeta-resumen por herramienta, calculada en cada
// visita a partir de los datos reales (nada de copias que se queden viejas), y
// la disposición que ha elegido la persona (guardada en ProjectMap).

const euros = (n: number) => `${Math.round(n).toLocaleString("es-ES")} €`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function buildMapCards(projectId: string): Promise<MapToolCard[]> {
  const data = await getProjectSummary(projectId);
  const hl = buildProjectHighlights(data);
  const { project } = data;

  const [pendingTasks, pendingCount, documents, board] = await Promise.all([
    prisma.task.findMany({
      where: { projectId, status: { not: "DONE" } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 5,
      select: { id: true, title: true, dueDate: true },
    }),
    prisma.task.count({ where: { projectId, status: { not: "DONE" } } }),
    prisma.document.count({ where: { projectId } }),
    prisma.moodboard.findUnique({ where: { projectId }, select: { cardCount: true } }),
  ]);

  const progress = (key: string) => {
    const p = hl.progress.find((x) => x.key === key);
    return p && p.total > 0 ? { done: p.done, total: p.total } : null;
  };
  const statusOf = (p: { done: number; total: number } | null): MapToolCard["status"] =>
    p ? (p.done === p.total ? "ok" : "warn") : null;

  const scenes = project.scenes.length;
  const charactersWithActor = project.characters.filter((c) => c.actorId).length;
  const scenesWithShots = project.scenes.filter((s) => s._count.shots > 0).length;
  const scenesWithLocation = project.scenes.filter((s) => s.locationId).length;
  const days = project.shootingDays.length;
  const callSheets = project.shootingDays.filter((d) => d.callSheet).length;
  const target = hl.budget.target;

  const card = (
    key: MapToolKey,
    title: string,
    slug: string,
    headline: string,
    lines: string[],
    prog: { done: number; total: number } | null = null,
    extra: Partial<MapToolCard> = {},
  ): MapToolCard => ({ key, title, slug, headline, lines, progress: prog, status: statusOf(prog), ...extra });

  const nextShoot = hl.nextShoot
    ? `Próximo: ${hl.nextShoot.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}`
    : null;

  return [
    card("proyecto", project.name, "", `${hl.headline.percent}% preparado`, [hl.headline.sentence], null, {
      status: null,
      project: {
        status: project.status,
        options: Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
      },
    }),
    card("guion", "Guion", "guion", plural(scenes, "escena", "escenas"), [
      plural(project.characters.length, "personaje", "personajes"),
      plural(data.locations.length, "localización", "localizaciones"),
    ], progress("guion")),
    card("desglose", "Desglose", "desglose", plural(project.breakdownElements.length, "elemento", "elementos"), [
      plural(project.crewMembers.length, "persona en el equipo", "personas en el equipo"),
    ]),
    card("personajes", "Personajes", "personajes", plural(project.actors.length, "actor", "actores"), [
      `${charactersWithActor} de ${project.characters.length} personajes con actor`,
    ], progress("reparto")),
    card("shot-list", "Shot list", "shot-list", plural(data.shotsTotal, "plano", "planos"), [
      `${scenesWithShots} de ${scenes} escenas con planos`,
    ], progress("shot-list")),
    card("storyboard", "Storyboard", "storyboard", plural(data.storyboardFramesCount, "viñeta", "viñetas"), [], progress("storyboard")),
    card("moodboard", "Moodboard", "moodboard", plural(board?.cardCount ?? 0, "tarjeta", "tarjetas"), ["Referencias e ideas visuales"]),
    card("plan-de-rodaje", "Plan de rodaje", "plan-de-rodaje", plural(days, "día de rodaje", "días de rodaje"), [
      ...(nextShoot ? [nextShoot] : []),
      `${hl.shots.planned} de ${hl.shots.total} planos planificados`,
    ], progress("plan")),
    card("call-sheets", "Call sheets", "call-sheets", `${callSheets} de ${days} listos`, [], progress("call-sheets")),
    card(
      "presupuesto",
      "Presupuesto",
      "presupuesto",
      euros(hl.budget.total),
      [
        ...(hl.budget.hasActual ? [`Gastado ${euros(hl.budget.actual)}`] : []),
        ...(target !== null ? [`de ${euros(target)} previstos`] : []),
      ],
      null,
      { status: target !== null && hl.budget.total > target ? "warn" : null },
    ),
    card("script", "Script", "script", plural(hl.script.takes, "toma", "tomas"), [`${hl.script.good} buenas`]),
    card("tareas", "Tareas", "tareas", plural(pendingCount, "pendiente", "pendientes"), [], null, {
      status: pendingCount === 0 ? "ok" : null,
      tasks: pendingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        due: t.dueDate ? t.dueDate.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : null,
      })),
    }),
    card("documentos", "Biblioteca de archivos", "documentos", plural(documents, "archivo", "archivos"), []),
    card("localizaciones", "Localizaciones", "localizaciones", plural(data.locations.length, "localización", "localizaciones"), [
      `${scenesWithLocation} de ${scenes} escenas con localización`,
    ]),
    card("vehiculos", "Vehículos y material", "vehiculos", plural(data.vehicles.length, "vehículo", "vehículos"), [
      plural(data.inventoryItems.length, "objeto de material", "objetos de material"),
    ]),
  ];
}

// ---------------------------------------------------------------------------
// Disposición guardada
// ---------------------------------------------------------------------------

const ID = /^[A-Za-z0-9_-]{1,60}$/;

function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function rect(value: unknown, key: MapToolKey): MapRect | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  const size = MAP_TOOL_SIZE[key];
  return {
    x: num(r.x, -50000, 50000, 0),
    y: num(r.y, -50000, 50000, 0),
    w: num(r.w, 180, 600, size.w),
    h: num(r.h, 100, 700, size.h),
  };
}

export function sanitizeMapLayout(input: unknown): MapLayout {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const tools: MapLayout["tools"] = {};
  const rawTools = (raw.tools && typeof raw.tools === "object" ? raw.tools : {}) as Record<string, unknown>;
  for (const key of MAP_TOOL_KEYS) {
    const r = rect(rawTools[key], key);
    if (r) tools[key] = r;
  }

  const hidden = [...new Set(Array.isArray(raw.hidden) ? raw.hidden : [])].filter((k): k is MapToolKey =>
    (MAP_TOOL_KEYS as readonly string[]).includes(k as string),
  );

  const seen = new Set<string>();
  const notes: MapNote[] = [];
  for (const n of (Array.isArray(raw.notes) ? raw.notes : []).slice(0, MAP_MAX_NOTES)) {
    if (!n || typeof n !== "object") continue;
    const o = n as Record<string, unknown>;
    if (typeof o.id !== "string" || !ID.test(o.id) || seen.has(o.id)) continue;
    seen.add(o.id);
    notes.push({
      id: o.id,
      text: typeof o.text === "string" && o.text.length > 0 ? o.text.slice(0, 1000) : undefined,
      color: (NOTE_COLORS as readonly string[]).includes(o.color as string) ? (o.color as string) : NOTE_COLORS[0],
      x: num(o.x, -50000, 50000, 0),
      y: num(o.y, -50000, 50000, 0),
      w: num(o.w, 80, 800, 220),
      h: num(o.h, 40, 800, 150),
    });
  }

  return { v: 1, tools, hidden, notes };
}

export async function getMapLayout(projectId: string): Promise<{ layout: MapLayout; updatedAt: string | null }> {
  const row = await prisma.projectMap.findUnique({ where: { projectId } });
  if (!row) return { layout: { v: 1, tools: {}, hidden: [], notes: [] }, updatedAt: null };
  return { layout: sanitizeMapLayout(row.data), updatedAt: row.updatedAt.toISOString() };
}

export type MapSaveResult = { ok: true; updatedAt: string } | { ok: false; error: string; conflict?: boolean };

// Guarda la disposición. Si otra persona guardó mientras tanto, no se pisa.
export async function saveMapLayoutCore(
  projectId: string,
  layoutInput: unknown,
  baseUpdatedAt: string | null,
): Promise<MapSaveResult> {
  const json = sanitizeMapLayout(layoutInput) as unknown as Prisma.InputJsonValue;
  const conflict: MapSaveResult = {
    ok: false,
    error: "Otra persona ha cambiado el mapa. Recarga para ver sus cambios.",
    conflict: true,
  };

  const current = await prisma.projectMap.findUnique({ where: { projectId } });
  if (!current) {
    if (baseUpdatedAt !== null) return conflict;
    try {
      const created = await prisma.projectMap.create({ data: { projectId, data: json } });
      return { ok: true, updatedAt: created.updatedAt.toISOString() };
    } catch {
      return conflict;
    }
  }
  if (baseUpdatedAt !== current.updatedAt.toISOString()) return conflict;

  const result = await prisma.projectMap.updateMany({
    where: { projectId, updatedAt: current.updatedAt },
    data: { data: json },
  });
  if (result.count === 0) return conflict;
  const fresh = await prisma.projectMap.findUnique({ where: { projectId }, select: { updatedAt: true } });
  return { ok: true, updatedAt: (fresh?.updatedAt ?? new Date()).toISOString() };
}
