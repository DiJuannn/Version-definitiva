import {
  BudgetIcon,
  CalendarIcon,
  CallSheetIcon,
  CastIcon,
  ClaquetaIcon,
  ContractIcon,
  EventIcon,
  FolderIcon,
  LocationIcon,
  MoodboardIcon,
  SceneIcon,
  ScheduleIcon,
  ScriptIcon,
  ShotListIcon,
  StackIcon,
  TakeReportIcon,
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
        icon: <ScriptIcon />,
        label: "Guion",
        href: "guion",
        description: "Sube el guion y gestiona las escenas.",
      },
      {
        icon: <StackIcon />,
        label: "Desglose",
        href: "desglose",
        description: "Lo que necesita cada escena: atrezzo, vestuario y equipo.",
      },
      {
        icon: <CastIcon />,
        label: "Personajes",
        href: "personajes",
        description: "El reparto: qué actor interpreta a cada personaje.",
      },
      {
        icon: <ShotListIcon />,
        label: "Lista de planos",
        href: "shot-list",
        description: "Los planos (shots) que vas a rodar en cada escena.",
      },
      {
        icon: <SceneIcon />,
        label: "Storyboard",
        href: "storyboard",
        description: "Viñetas visuales de los planos clave.",
      },
      {
        icon: <MoodboardIcon />,
        label: "Moodboard",
        href: "moodboard",
        description: "Un tablero libre de referencias, con tarjetas de tu proyecto y sugerencias de IA.",
      },
      {
        icon: <CalendarIcon />,
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
        icon: <ScheduleIcon />,
        label: "Plan de rodaje",
        href: "plan-de-rodaje",
        description: "Agrupa las escenas en días de rodaje concretos.",
      },
      {
        icon: <CallSheetIcon />,
        label: "Hojas de llamada",
        href: "call-sheets",
        description: "La hoja de convocatoria (call sheet): quién va, dónde y a qué hora, cada día.",
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
      {
        icon: <TakeReportIcon />,
        label: "Parte de script",
        href: "script",
        description: "El parte de script: las tomas del rodaje, cuáles son buenas y sus notas.",
      },
    ],
  },
  {
    label: "Gestión",
    tools: [
      {
        icon: <TaskIcon />,
        label: "Tareas",
        href: "tareas",
        description: "Pendientes del proyecto, con prioridad y fecha.",
      },
      {
        icon: <FolderIcon />,
        label: "Biblioteca de archivos",
        href: "documentos",
        description: "Contratos, permisos y archivos del proyecto.",
      },
      {
        icon: <ContractIcon />,
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
      {
        icon: <EventIcon />,
        label: "Festivales",
        href: "festivales",
        description: "Dónde presentar tu proyecto: festivales de tu zona, online y convocatorias abiertas.",
      },
    ],
  },
];
