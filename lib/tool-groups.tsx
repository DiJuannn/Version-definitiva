import {
  BudgetIcon,
  CalendarIcon,
  CastIcon,
  ClaquetaIcon,
  DocumentIcon,
  EventIcon,
  LocationIcon,
  ProjectsIcon,
  SceneIcon,
  ShotListIcon,
  TaskIcon,
  VehicleIcon,
} from "@/components/ToolIcons";

export type ToolDefinition = {
  icon: React.ReactNode;
  label: string;
  href: string;
  description: string;
  absolute?: boolean;
  pro?: boolean;
};

// Fuente única de la taxonomía de herramientas del Taller — usada por la
// ficha de cada proyecto ([projectId]/page.tsx) y por el selector de
// herramientas de /app/proyectos, para que ambas enseñen exactamente lo
// mismo sin mantener dos listas por separado.
export const TOOL_GROUPS: { label: string; tools: ToolDefinition[] }[] = [
  {
    label: "Preproducción",
    tools: [
      {
        icon: <DocumentIcon />,
        label: "Guion",
        href: "guion",
        description: "Sube el guion y gestiona las escenas.",
      },
      {
        icon: <ProjectsIcon />,
        label: "Desglose",
        href: "desglose",
        description: "Catálogo de atrezzo, vestuario y equipo por escena.",
      },
      {
        icon: <CastIcon />,
        label: "Personajes",
        href: "personajes",
        description: "El reparto: qué actor interpreta a cada personaje.",
      },
      {
        icon: <ShotListIcon />,
        label: "Shot list",
        href: "shot-list",
        description: "Los planos definidos para cada escena.",
      },
      {
        icon: <SceneIcon />,
        label: "Storyboard",
        href: "storyboard",
        description: "Viñetas visuales de los planos clave.",
      },
      {
        icon: <EventIcon />,
        label: "Calendario",
        href: "/app/calendario",
        absolute: true,
        description: "Reuniones, ensayos y fechas límite de la productora.",
      },
    ],
  },
  {
    label: "Producción",
    tools: [
      {
        icon: <CalendarIcon />,
        label: "Plan de rodaje",
        href: "plan-de-rodaje",
        description: "Agrupa las escenas en días de rodaje concretos.",
      },
      {
        icon: <DocumentIcon />,
        label: "Call sheets",
        href: "call-sheets",
        description: "La hoja de convocatoria de cada día de rodaje.",
      },
      {
        icon: <BudgetIcon />,
        label: "Presupuesto",
        href: "presupuesto",
        description: "Categorías de gasto, importes y coste total.",
      },
      {
        icon: <ClaquetaIcon />,
        label: "Claqueta",
        href: "claqueta",
        description: "Claqueta digital: marca tomas con sonido y animación.",
      },
    ],
  },
  {
    label: "Organización",
    tools: [
      {
        icon: <TaskIcon />,
        label: "Tareas",
        href: "tareas",
        description: "Pendientes del proyecto, con prioridad y fecha.",
      },
      {
        icon: <DocumentIcon />,
        label: "Biblioteca de archivos",
        href: "documentos",
        description: "Contratos, permisos y archivos del proyecto.",
      },
      {
        icon: <DocumentIcon />,
        label: "Plantilla de documentos",
        href: "documentos-legales",
        description: "Plantillas de permisos, cesiones y contratos, listas para firmar.",
        pro: true,
      },
      {
        icon: <LocationIcon />,
        label: "Localizaciones",
        href: "localizaciones",
        description: "Las que ya usan las escenas de este proyecto.",
      },
      {
        icon: <VehicleIcon />,
        label: "Vehículos",
        href: "vehiculos",
        description: "Los que ya están reservados en este proyecto.",
      },
    ],
  },
];
