import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ProjectRoadmap } from "@/components/ProjectRoadmap";
import { ProjectHealthMini } from "@/components/ProjectHealthMini";
import { DashboardStagger } from "@/components/DashboardMotion";
import { PdfLink } from "@/components/PdfLink";
import { getProjectOverview } from "@/lib/project-roadmap";
import {
  BudgetIcon,
  CalendarIcon,
  CastIcon,
  DocumentIcon,
  LocationIcon,
  ProjectsIcon,
  SceneIcon,
  ShotListIcon,
  SummaryIcon,
  TaskIcon,
} from "@/components/ToolIcons";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { updateProjectDetails } from "@/lib/actions/project-details";

const TOOLS = [
  {
    icon: <SummaryIcon />,
    label: "Resumen",
    href: "resumen",
    description: "Todo el proyecto de un vistazo, como tu propio dossier.",
  },
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
    icon: <LocationIcon />,
    label: "Localizaciones",
    href: "/app/localizaciones",
    absolute: true,
    description: "Todas las localizaciones de la productora.",
  },
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
    icon: <BudgetIcon />,
    label: "Presupuesto",
    href: "presupuesto",
    description: "Categorías de gasto, importes y coste total.",
  },
  {
    icon: <TaskIcon />,
    label: "Tareas",
    href: "tareas",
    description: "Pendientes del proyecto, con prioridad y fecha.",
  },
  {
    icon: <DocumentIcon />,
    label: "Documentos",
    href: "documentos",
    description: "Contratos, permisos y archivos del proyecto.",
  },
];

export default async function ProjectTallerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);

  if (!project) {
    notFound();
  }

  const updateAction = updateProjectDetails.bind(null, project.id);
  const budgetTarget =
    project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const { steps, healthMetrics } = await getProjectOverview(project.id, budgetTarget);

  return (
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Proyectos
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        {project.name}
      </h1>

      <ProjectSummaryCard
        project={{ ...project, budgetTarget }}
        updateAction={updateAction}
      />

      <ProjectRoadmap steps={steps} />

      <div className="mt-10 border border-line p-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Herramientas
          </p>
          <PdfLink
            href={`/api/pdf/dossier/${project.id}`}
            label="Descargar dossier"
          />
        </div>
        <DashboardStagger className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.label}
              icon={tool.icon}
              label={tool.label}
              description={tool.description}
              href={
                !tool.href
                  ? undefined
                  : "absolute" in tool && tool.absolute
                    ? tool.href
                    : `/app/${project.id}/${tool.href}`
              }
            />
          ))}
        </DashboardStagger>
      </div>

      <ProjectHealthMini metrics={healthMetrics} />
    </div>
  );
}
