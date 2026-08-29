import { ToolCard } from "@/components/ToolCard";
import {
  BudgetIcon,
  CalendarIcon,
  CastIcon,
  DocumentIcon,
  LocationIcon,
  ProjectsIcon,
  SceneIcon,
  ShotListIcon,
} from "@/components/ToolIcons";

const TOOLS = [
  { href: "/taller/proyectos", icon: <ProjectsIcon />, label: "Proyectos" },
  { icon: <SceneIcon />, label: "Escenas" },
  { icon: <CastIcon />, label: "Personajes" },
  { icon: <LocationIcon />, label: "Localizaciones" },
  { icon: <BudgetIcon />, label: "Presupuesto" },
  { icon: <CalendarIcon />, label: "Plan de rodaje" },
  { icon: <ShotListIcon />, label: "Shot list" },
  { icon: <DocumentIcon />, label: "Documentos" },
];

export default function TallerHomePage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">Taller</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Elige una herramienta.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.label} {...tool} />
        ))}
      </div>
    </div>
  );
}
