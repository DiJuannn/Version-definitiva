// Tipos de proyecto y punto de partida que se preguntan al crear el primer
// proyecto (web y app). Sin dependencias de servidor para poder usarse en
// componentes de cliente.
export const PROJECT_TYPES = [
  "Cortometraje",
  "Largometraje",
  "Publicidad",
  "Videoclip",
  "Documental",
  "Serie",
  "Otro",
] as const;

export const PROJECT_STAGES = [
  { id: "idea", label: "Solo tengo la idea", hint: "Empezamos por lo básico y te guiamos paso a paso." },
  { id: "guion", label: "Ya tengo el guion", hint: "Lo subes y la IA propone escenas, personajes y desglose." },
  { id: "rodaje", label: "Estoy preparando el rodaje", hint: "Equipo, plan de rodaje y presupuesto." },
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number]["id"];
