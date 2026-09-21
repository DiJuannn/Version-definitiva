import { NOTE_COLORS } from "@/lib/moodboard-types";

// Tipos y constantes del Mapa del proyecto sin dependencias de servidor, para
// usarlos en el editor (cliente) y en lib/project-map.ts (servidor).

export const MAP_TOOL_KEYS = [
  "proyecto",
  "guion",
  "desglose",
  "personajes",
  "shot-list",
  "storyboard",
  "moodboard",
  "plan-de-rodaje",
  "call-sheets",
  "presupuesto",
  "script",
  "tareas",
  "documentos",
  "localizaciones",
  "vehiculos",
] as const;
export type MapToolKey = (typeof MAP_TOOL_KEYS)[number];

export type MapPhase = "proyecto" | "pre" | "prod" | "gestion";

export const MAP_PHASES: { id: MapPhase; label: string }[] = [
  { id: "proyecto", label: "Proyecto" },
  { id: "pre", label: "Preproducción" },
  { id: "prod", label: "Producción" },
  { id: "gestion", label: "Gestión" },
];

export const MAP_TOOL_PHASE: Record<MapToolKey, MapPhase> = {
  proyecto: "proyecto",
  guion: "pre",
  desglose: "pre",
  personajes: "pre",
  "shot-list": "pre",
  storyboard: "pre",
  moodboard: "pre",
  "plan-de-rodaje": "prod",
  "call-sheets": "prod",
  presupuesto: "prod",
  script: "prod",
  tareas: "gestion",
  documentos: "gestion",
  localizaciones: "gestion",
  vehiculos: "gestion",
};

export const MAP_TOOL_SIZE: Record<MapToolKey, { w: number; h: number }> = {
  proyecto: { w: 270, h: 190 },
  guion: { w: 250, h: 160 },
  desglose: { w: 250, h: 150 },
  personajes: { w: 250, h: 170 },
  "shot-list": { w: 250, h: 150 },
  storyboard: { w: 250, h: 150 },
  moodboard: { w: 250, h: 140 },
  "plan-de-rodaje": { w: 250, h: 170 },
  "call-sheets": { w: 250, h: 150 },
  presupuesto: { w: 250, h: 170 },
  script: { w: 250, h: 140 },
  tareas: { w: 270, h: 240 },
  documentos: { w: 250, h: 130 },
  localizaciones: { w: 250, h: 140 },
  vehiculos: { w: 250, h: 140 },
};

export type MapToolCard = {
  key: MapToolKey;
  title: string;
  // Trozo de ruta tras /app/<proyecto>/
  slug: string;
  headline: string;
  lines: string[];
  progress: { done: number; total: number } | null;
  status: "ok" | "warn" | null;
  // Solo la tarjeta de tareas: pendientes con casilla para completarlas.
  tasks?: { id: string; title: string; due: string | null }[];
  // Solo la tarjeta del proyecto: estado editable.
  project?: { status: string; options: { value: string; label: string }[] };
};

export type MapRect = { x: number; y: number; w: number; h: number };

// Elementos propios de la pizarra (lo que pone la persona, además de las tarjetas de herramienta).
export const MAP_ITEM_TYPES = ["note", "text", "image", "shape", "section", "entity"] as const;
export type MapItemType = (typeof MAP_ITEM_TYPES)[number];
export const MAP_SHAPES = ["rect", "round", "ellipse"] as const;
export type MapShape = (typeof MAP_SHAPES)[number];
export const MAP_TEXT_SIZES = ["s", "m", "l"] as const;
export type MapTextSize = (typeof MAP_TEXT_SIZES)[number];

// Colores de formas, secciones, textos y flechas (pensados para el fondo oscuro).
export const MAP_COLORS = ["#a08fd0", "#ff4d1c", "#4f9d7a", "#d9a441", "#4a7fc1", "#8a8a84", "#f2f0ea"] as const;

export type MapItem = {
  id: string;
  type: MapItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  // note / text / shape (etiqueta)
  text?: string;
  // note: uno de NOTE_COLORS; text, shape, section: uno de MAP_COLORS
  color?: string;
  // text
  size?: MapTextSize;
  // image
  url?: string;
  caption?: string;
  // shape
  shape?: MapShape;
  // section
  title?: string;
  // entity: una cosa del proyecto (escena, tarea, plano…) que se muestra en vivo
  kind?: MapEntityKind;
  refId?: string;
  // Nombre con el que se encontró (para volver a encontrarla si su id cambia, p. ej. al restaurar un guion).
  label?: string;
};

// Cosas del proyecto que se pueden poner en la pizarra como tarjeta suelta.
export const MAP_ENTITY_KINDS = ["scene", "character", "location", "shot", "task", "day", "budget", "document", "crew"] as const;
export type MapEntityKind = (typeof MAP_ENTITY_KINDS)[number];

export const MAP_ENTITY_LABELS: Record<MapEntityKind, { one: string; many: string }> = {
  scene: { one: "Escena", many: "Escenas" },
  character: { one: "Personaje", many: "Personajes" },
  location: { one: "Localización", many: "Lugares" },
  shot: { one: "Plano", many: "Planos" },
  task: { one: "Tarea", many: "Tareas" },
  day: { one: "Día de rodaje", many: "Días" },
  budget: { one: "Presupuesto", many: "Presupuesto" },
  document: { one: "Archivo", many: "Archivos" },
  crew: { one: "Equipo", many: "Equipo" },
};

// Cómo se ve una cosa del proyecto en su tarjeta (lo calcula el servidor en cada visita).
export type MapEntityView = {
  id: string;
  title: string;
  sub?: string;
  body?: string;
  tag?: string;
  // Solo tareas: si ya está hecha.
  done?: boolean;
  // Trozo de ruta tras /app/<proyecto>/
  slug: string;
};
export type MapEntities = Partial<Record<MapEntityKind, MapEntityView[]>>;

export type MapBoardInfo = { id: string; name: string; shared: boolean };

// Línea o flecha entre dos elementos (tarjetas de herramienta incluidas; su id es "tool-<clave>").
export type MapEdge = {
  id: string;
  source: string;
  target: string;
  // Punto de anclaje de cada extremo: t, r, b, l.
  sh?: string;
  th?: string;
  label?: string;
  color?: string;
  dashed?: boolean;
  arrow?: boolean;
};

export type MapLayout = {
  v: 2;
  tools: Partial<Record<MapToolKey, MapRect>>;
  hidden: MapToolKey[];
  items: MapItem[];
  edges: MapEdge[];
};

export const MAP_MAX_EDGES = 400;

export const MAP_ITEM_SIZE: Record<MapItemType, { w: number; h: number }> = {
  note: { w: 220, h: 150 },
  text: { w: 260, h: 60 },
  image: { w: 280, h: 200 },
  shape: { w: 200, h: 120 },
  section: { w: 520, h: 360 },
  entity: { w: 240, h: 130 },
};

export { NOTE_COLORS };

// Disposición por defecto: una columna por fase, de izquierda a derecha.
export function defaultToolRect(key: MapToolKey): MapRect {
  const phase = MAP_TOOL_PHASE[key];
  const column = MAP_PHASES.findIndex((p) => p.id === phase);
  const inPhase = MAP_TOOL_KEYS.filter((k) => MAP_TOOL_PHASE[k] === phase);
  const gap = 24;
  let y = 0;
  for (const k of inPhase) {
    if (k === key) break;
    y += MAP_TOOL_SIZE[k].h + gap;
  }
  return { x: column * (270 + 50), y, ...MAP_TOOL_SIZE[key] };
}
