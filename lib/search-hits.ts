// Resultados de búsqueda dentro de un proyecto: tipos y rutas. Sin base de datos (lo usan componentes de cliente).

export type SearchHitKind = "scene" | "character" | "actor" | "location" | "task" | "breakdown" | "budget";

export type SearchHit = {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle: string | null;
};

// Ruta (dentro del proyecto) a la que lleva cada resultado.
export function hitPath(hit: Pick<SearchHit, "kind" | "id">): string {
  switch (hit.kind) {
    case "scene":
      return `guion/${hit.id}`;
    case "character":
    case "actor":
      return "personajes";
    case "location":
      return "localizaciones";
    case "task":
      return "tareas";
    case "breakdown":
      return "desglose";
    case "budget":
      return "presupuesto";
  }
}

export const HIT_GROUP_LABELS: Record<SearchHitKind, string> = {
  scene: "Escenas",
  character: "Personajes",
  actor: "Actores",
  location: "Localizaciones",
  task: "Tareas",
  breakdown: "Desglose",
  budget: "Presupuesto",
};
