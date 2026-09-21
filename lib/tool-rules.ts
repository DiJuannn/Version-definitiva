import type { ProjectStatus } from "@/lib/generated/prisma";

// Reglas puras (sin base de datos ni cookies): las usan tanto el servidor como los componentes de cliente.
// Portada guiada del proyecto: qué herramientas se enseñan y cuándo.

export type ToolMode = "simple" | "full";

export type ProjectFacts = {
  status: ProjectStatus;
  scenes: number;
  characters: number;
  // Días de rodaje planificados y cuántos ya han llegado (hoy o antes).
  days: number;
  pastDays: number;
};

export type ToolAccess = { unlocked: boolean; reason?: string };

const NEEDS_SCENES = "Se activa cuando el guion tenga escenas.";
const NEEDS_DAY = "Se activa al planificar tu primer día de rodaje.";
const NEEDS_SHOOT = "Se activa cuando empiece el rodaje.";

// Claves = `href` de cada herramienta en TOOL_GROUPS.
export function computeAccess(f: ProjectFacts): Record<string, ToolAccess> {
  const hasScenes = f.scenes > 0;
  const hasDays = f.days > 0;
  const shooting = f.pastDays > 0 || f.status === "PRODUCTION" || f.status === "POST_PRODUCTION" || f.status === "FINISHED";
  const need = (ok: boolean, reason: string): ToolAccess => (ok ? { unlocked: true } : { unlocked: false, reason });

  return {
    guion: { unlocked: true },
    personajes: { unlocked: true },
    presupuesto: { unlocked: true },
    tareas: { unlocked: true },
    desglose: need(hasScenes, NEEDS_SCENES),
    "shot-list": need(hasScenes, NEEDS_SCENES),
    storyboard: need(hasScenes, NEEDS_SCENES),
    moodboard: need(hasScenes, NEEDS_SCENES),
    localizaciones: need(hasScenes, NEEDS_SCENES),
    "plan-de-rodaje": need(hasScenes, NEEDS_SCENES),
    documentos: need(hasDays, NEEDS_DAY),
    "call-sheets": need(hasDays, NEEDS_DAY),
    "/app/calendario": need(hasDays, NEEDS_DAY),
    vehiculos: need(hasDays, NEEDS_DAY),
    "documentos-legales": need(hasDays, NEEDS_DAY),
    claqueta: need(shooting || hasDays, hasDays ? NEEDS_SHOOT : NEEDS_DAY),
    script: need(shooting || hasDays, hasDays ? NEEDS_SHOOT : NEEDS_DAY),
  };
}

export function isUnlocked(access: Record<string, ToolAccess>, href: string): boolean {
  return access[href]?.unlocked !== false;
}

export const STAGES = [
  { id: 1, label: "Idea", hint: "Guion y personajes" },
  { id: 2, label: "Preparar", hint: "Plan, presupuesto y equipo" },
  { id: 3, label: "Rodar", hint: "Rodaje y tomas" },
  { id: 4, label: "Entregar", hint: "Montaje y entrega" },
] as const;

// En qué etapa está el proyecto, según lo que tiene y su estado.
export function computeStage(f: ProjectFacts): 1 | 2 | 3 | 4 {
  if (f.status === "POST_PRODUCTION" || f.status === "FINISHED") return 4;
  if (f.status === "PRODUCTION" || f.pastDays > 0) return 3;
  if (f.scenes > 0) return 2;
  return 1;
}
