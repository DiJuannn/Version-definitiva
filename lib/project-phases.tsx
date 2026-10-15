import { TOOL_GROUPS, type ToolDefinition } from "@/lib/tool-groups";

// Cómo se recorre un proyecto: cuatro fases, cada una con sus herramientas.
// Es lo que enseña el menú del proyecto (fases arriba, herramientas de la
// fase debajo, siempre a la vista) y la portada. TOOL_GROUPS sigue siendo la
// lista completa (búsqueda, selector de herramientas, app móvil); aquí solo
// se decide el orden y qué va junto.

export type PhaseId = 1 | 2 | 3 | 4;

export type Phase = {
  id: PhaseId;
  label: string;
  // Qué se hace en esta fase, en una línea.
  hint: string;
  tools: ToolDefinition[];
};

const byHref = new Map(TOOL_GROUPS.flatMap((g) => g.tools).map((t) => [t.href, t]));
const pick = (href: string, overrides: Partial<ToolDefinition> = {}): ToolDefinition => {
  const tool = byHref.get(href);
  if (!tool) throw new Error(`Herramienta desconocida: ${href}`);
  return { ...tool, ...overrides };
};

export const PHASES: Phase[] = [
  {
    id: 1,
    label: "Escribir",
    hint: "El guion, sus personajes y el tono visual.",
    tools: [pick("guion"), pick("personajes"), pick("moodboard")],
  },
  {
    id: 2,
    label: "Preparar",
    hint: "Qué hace falta, cómo se rueda, con quién, dónde y cuánto cuesta.",
    tools: [
      pick("desglose"),
      pick("shot-list", { label: "Planos", description: "Cómo se rueda cada escena, plano a plano, y el guion técnico." }),
      pick("storyboard"),
      pick("equipo"),
      pick("localizaciones"),
      pick("presupuesto"),
    ],
  },
  {
    id: 3,
    label: "Rodar",
    hint: "Las jornadas, a quién se cita y cada toma.",
    tools: [
      pick("plan-de-rodaje"),
      pick("call-sheets"),
      pick("claqueta"),
      pick("script"),
      pick("vehiculos", { label: "Material y vehículos" }),
    ],
  },
  {
    id: 4,
    label: "Entregar",
    hint: "Montaje, papeles y festivales.",
    tools: [
      pick("montaje"),
      pick("festivales"),
      pick("documentos", { label: "Archivos" }),
      pick("documentos-legales", { label: "Contratos y permisos" }),
    ],
  },
];

// Rutas que pertenecen a una herramienta de otra.
const ALIASES: Record<string, string> = {};

// En qué fase está una ruta del proyecto (/app/<id>/<segmento>/...), o null
// si no es de ninguna (portada, resumen, tareas).
export function phaseOfSegment(segment: string | undefined): PhaseId | null {
  if (!segment) return null;
  const href = ALIASES[segment] ?? segment;
  return PHASES.find((p) => p.tools.some((t) => t.href === href))?.id ?? null;
}

export function toolOfSegment(segment: string | undefined): string | null {
  if (!segment) return null;
  return ALIASES[segment] ?? segment;
}
