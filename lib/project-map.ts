import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { buildProjectHighlights, getProjectSummary } from "@/lib/project-summary";
import { PROJECT_STATUS_LABELS } from "@/lib/labels";
import { MAP_FREE_ITEM_LIMIT, MAP_MAX_ITEMS } from "@/lib/limits";
import {
  MAP_COLORS,
  MAP_ITEM_SIZE,
  MAP_ITEM_TYPES,
  MAP_MAX_EDGES,
  MAP_SHAPES,
  MAP_TEXT_SIZES,
  MAP_TOOL_KEYS,
  MAP_TOOL_SIZE,
  NOTE_COLORS,
  type MapEdge,
  type MapItem,
  type MapItemType,
  type MapLayout,
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

const ID = /^[A-Za-z0-9_-]{1,70}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function text(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, max) : undefined;
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

// Solo imágenes por https.
function safeUrl(value: unknown): string | undefined {
  const url = text(value, 1000);
  if (!url) return undefined;
  try {
    return new URL(url).protocol === "https:" ? new URL(url).toString() : undefined;
  } catch {
    return undefined;
  }
}

const mapColor = (value: unknown) => (typeof value === "string" && (MAP_COLORS as readonly string[]).includes(value) ? value : undefined);

function sanitizeItems(raw: unknown[]): MapItem[] {
  const seen = new Set<string>();
  const items: MapItem[] = [];
  for (const n of raw.slice(0, MAP_MAX_ITEMS)) {
    if (!n || typeof n !== "object") continue;
    const o = n as Record<string, unknown>;
    if (typeof o.id !== "string" || !ID.test(o.id) || o.id.startsWith("tool-") || seen.has(o.id)) continue;
    if (!(MAP_ITEM_TYPES as readonly string[]).includes(o.type as string)) continue;
    const type = o.type as MapItemType;
    const size = MAP_ITEM_SIZE[type];
    const item: MapItem = {
      id: o.id,
      type,
      x: num(o.x, -50000, 50000, 0),
      y: num(o.y, -50000, 50000, 0),
      w: num(o.w, 40, 1600, size.w),
      h: num(o.h, 24, 1600, size.h),
    };
    if (type === "note") {
      item.text = text(o.text, 2000);
      item.color = (NOTE_COLORS as readonly string[]).includes(o.color as string) ? (o.color as string) : NOTE_COLORS[0];
    } else if (type === "text") {
      item.text = text(o.text, 1000);
      item.size = (MAP_TEXT_SIZES as readonly string[]).includes(o.size as string) ? (o.size as MapItem["size"]) : "m";
      item.color = mapColor(o.color) ?? MAP_COLORS[6];
    } else if (type === "image") {
      item.url = safeUrl(o.url);
      if (!item.url) continue;
      item.caption = text(o.caption, 200);
    } else if (type === "shape") {
      item.shape = (MAP_SHAPES as readonly string[]).includes(o.shape as string) ? (o.shape as MapItem["shape"]) : "rect";
      item.color = mapColor(o.color) ?? MAP_COLORS[0];
      item.text = text(o.text, 300);
    } else {
      item.title = text(o.title, 120);
      item.color = mapColor(o.color) ?? MAP_COLORS[5];
    }
    seen.add(o.id);
    items.push(item);
  }
  return items;
}

function sanitizeEdges(raw: unknown[], validIds: Set<string>): MapEdge[] {
  const seen = new Set<string>();
  const edges: MapEdge[] = [];
  const handle = (v: unknown) => (typeof v === "string" && ["t", "r", "b", "l"].includes(v) ? v : undefined);
  for (const e of raw.slice(0, MAP_MAX_EDGES)) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    if (typeof o.id !== "string" || !ID.test(o.id) || seen.has(o.id)) continue;
    if (typeof o.source !== "string" || typeof o.target !== "string") continue;
    if (o.source === o.target || !validIds.has(o.source) || !validIds.has(o.target)) continue;
    seen.add(o.id);
    edges.push({
      id: o.id,
      source: o.source,
      target: o.target,
      sh: handle(o.sh),
      th: handle(o.th),
      label: text(o.label, 80),
      color: typeof o.color === "string" && HEX.test(o.color) && (MAP_COLORS as readonly string[]).includes(o.color) ? o.color : undefined,
      dashed: o.dashed === true ? true : undefined,
      arrow: o.arrow === false ? false : undefined,
    });
  }
  return edges;
}

// Lee tanto la disposición nueva (v2: items + edges) como la primera versión (v1: solo notas).
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

  const legacyNotes = (Array.isArray(raw.notes) ? raw.notes : []).map((n) => ({ ...(n as object), type: "note" }));
  const items = sanitizeItems([...(Array.isArray(raw.items) ? raw.items : []), ...legacyNotes]);

  const validIds = new Set<string>([...MAP_TOOL_KEYS.map((k) => `tool-${k}`), ...items.map((i) => i.id)]);
  const edges = sanitizeEdges(Array.isArray(raw.edges) ? raw.edges : [], validIds);

  return { v: 2, tools, hidden, items, edges };
}

export async function getMapLayout(projectId: string): Promise<{ layout: MapLayout; updatedAt: string | null }> {
  const row = await prisma.projectMap.findUnique({ where: { projectId } });
  if (!row) return { layout: { v: 2, tools: {}, hidden: [], items: [], edges: [] }, updatedAt: null };
  return { layout: sanitizeMapLayout(row.data), updatedAt: row.updatedAt.toISOString() };
}

export type MapSaveResult = { ok: true; updatedAt: string } | { ok: false; error: string; conflict?: boolean };

// Guarda la disposición. Si otra persona guardó mientras tanto, no se pisa. El plan
// gratuito no puede pasar del tope de elementos propios (lo que ya hubiera de
// cuando era PRO se respeta mientras no crezca).
export async function saveMapLayoutCore(
  projectId: string,
  layoutInput: unknown,
  baseUpdatedAt: string | null,
  isPro: boolean,
): Promise<MapSaveResult> {
  const layout = sanitizeMapLayout(layoutInput);
  const json = layout as unknown as Prisma.InputJsonValue;
  const conflict: MapSaveResult = {
    ok: false,
    error: "Otra persona ha cambiado el mapa. Recarga para ver sus cambios.",
    conflict: true,
  };

  const current = await prisma.projectMap.findUnique({ where: { projectId } });

  if (!isPro) {
    const stored = current ? sanitizeMapLayout(current.data).items.length : 0;
    if (layout.items.length > Math.max(MAP_FREE_ITEM_LIMIT, stored)) {
      return {
        ok: false,
        error: `El plan gratuito permite hasta ${MAP_FREE_ITEM_LIMIT} elementos propios en el mapa. Pásate a PRO para tener más.`,
      };
    }
  }

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

// Imágenes que ya hay en el proyecto (viñetas del storyboard y fotos de sus
// localizaciones), para ponerlas en la pizarra sin subirlas otra vez.
export type MapProjectImage = { url: string; label: string };

export async function getMapProjectImages(projectId: string): Promise<MapProjectImage[]> {
  const [frames, locations] = await Promise.all([
    prisma.storyboardFrame.findMany({
      where: { imageUrl: { not: null }, shot: { scene: { projectId } } },
      orderBy: { createdAt: "asc" },
      take: 60,
      select: { imageUrl: true, shot: { select: { number: true, scene: { select: { number: true } } } } },
    }),
    prisma.location.findMany({
      where: { scenes: { some: { projectId } } },
      take: 20,
      select: { name: true, photoUrls: true },
    }),
  ]);

  const images: MapProjectImage[] = [];
  for (const f of frames) {
    if (f.imageUrl?.startsWith("https://")) images.push({ url: f.imageUrl, label: `Viñeta ${f.shot.scene.number}.${f.shot.number}` });
  }
  for (const l of locations) {
    for (const url of l.photoUrls.slice(0, 6)) if (url.startsWith("https://")) images.push({ url, label: l.name });
  }
  return images.slice(0, 80);
}
