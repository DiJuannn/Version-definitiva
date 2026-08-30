import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ProjectRoadmap } from "@/components/ProjectRoadmap";
import { ProjectHealthMini } from "@/components/ProjectHealthMini";
import { DashboardStagger } from "@/components/DashboardMotion";
import { ToolGroupCarousel } from "@/components/ToolGroupCarousel";
import { PdfLink } from "@/components/PdfLink";
import { getProjectOverview } from "@/lib/project-roadmap";
import {
  BudgetIcon,
  CalendarIcon,
  CastIcon,
  DocumentIcon,
  EventIcon,
  LocationIcon,
  ProjectsIcon,
  SceneIcon,
  ShotListIcon,
  SummaryIcon,
  TaskIcon,
} from "@/components/ToolIcons";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { updateProjectDetails } from "@/lib/actions/project-details";

// Mismas categorías que ProjectSubNav — misma taxonomía en toda la app.
const TOOL_GROUPS = [
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
        label: "Documentos",
        href: "documentos",
        description: "Contratos, permisos y archivos del proyecto.",
      },
      {
        icon: <LocationIcon />,
        label: "Localizaciones",
        href: "/app/localizaciones",
        absolute: true,
        description: "Todas las localizaciones de la productora.",
      },
    ],
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

  // Los hrefs deben llegar ya resueltos: una función no se puede pasar de
  // un Server Component (esta página) a ToolGroupCarousel (Client Component).
  const resolvedToolGroups = TOOL_GROUPS.map((group) => ({
    label: group.label,
    tools: group.tools.map((tool) => ({
      icon: tool.icon,
      label: tool.label,
      description: tool.description,
      href: "absolute" in tool && tool.absolute ? tool.href : `/app/${project.id}/${tool.href}`,
    })),
  }));

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Herramientas
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/app/${project.id}/resumen`}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase transition-colors hover:text-accent"
            >
              <SummaryIcon />
              Resumen completo →
            </Link>
            <PdfLink
              href={`/api/pdf/dossier/${project.id}`}
              label="Descargar dossier"
            />
          </div>
        </div>

        <div className="mt-4">
          <ToolGroupCarousel groups={resolvedToolGroups} />
        </div>

        <div className="hidden sm:block">
          {TOOL_GROUPS.map((group) => (
            <div key={group.label} className="mt-6 first:mt-4">
              <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                {group.label}
              </p>
              <DashboardStagger className="mt-3 grid grid-cols-3 gap-4">
                {group.tools.map((tool) => (
                  <ToolCard
                    key={tool.label}
                    icon={tool.icon}
                    label={tool.label}
                    description={tool.description}
                    href={
                      "absolute" in tool && tool.absolute
                        ? tool.href
                        : `/app/${project.id}/${tool.href}`
                    }
                  />
                ))}
              </DashboardStagger>
            </div>
          ))}
        </div>
      </div>

      <ProjectHealthMini metrics={healthMetrics} />
    </div>
  );
}
