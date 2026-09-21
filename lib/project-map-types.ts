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

export type MapNote = { id: string; text?: string; color: string; x: number; y: number; w: number; h: number };
export type MapRect = { x: number; y: number; w: number; h: number };

export type MapLayout = {
  v: 1;
  tools: Partial<Record<MapToolKey, MapRect>>;
  hidden: MapToolKey[];
  notes: MapNote[];
};

export const MAP_MAX_NOTES = 100;
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
