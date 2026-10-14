import Link from "next/link";
import { deleteProject } from "@/lib/actions/projects";
import { getCurrentProfile } from "@/lib/current-user";
import { listProjectsForProfile } from "@/lib/project-access";
import { getProjectsProgress } from "@/lib/projects-progress";
import { StatusPill } from "@/components/StatusPill";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { NewProjectPanel } from "@/components/NewProjectPanel";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { ToolPickerGrid } from "@/components/ToolPickerGrid";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GROUPS } from "@/lib/tool-groups";

// Proyectos: la lista (papel, una fila por proyecto) y, debajo, los atajos para ir directo a una
// herramienta. Crear es un botón arriba que abre un diálogo; sin proyectos, el asistente va directo.
export default async function ProyectosPage() {
  const profile = await getCurrentProfile();

  const projects = profile ? await listProjectsForProfile(profile) : [];
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  const progress = await getProjectsProgress(projects.map((p) => p.id));

  return (
    <div className="pb-8">
      <PageHeader
        title="Proyectos"
        description={
          projects.length === 0
            ? "Todo en Taller cuelga de un proyecto. Crea el primero para empezar."
            : `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}. Entra en uno para ver su camino y sus herramientas, o salta directo a una herramienta más abajo.`
        }
        actions={projects.length > 0 ? <NewProjectPanel /> : undefined}
      />

      {projects.length === 0 ? (
        <div className="sheet mx-auto mt-10 max-w-xl p-8 sm:p-10">
          <p className="eyebrow text-center text-accent">Tu primer proyecto</p>
          <div className="mt-6">
            <NewProjectWizard />
          </div>
        </div>
      ) : (
        <ul className="sheet mt-10 divide-y divide-line overflow-hidden">
          {projects.map((project) => {
            const isOwnProject = project.organizationId === profile?.organizationId;
            const ownerLabel = project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name;
            const p = progress[project.id];
            const pct = p && p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <li key={project.id} className="group flex items-center gap-2 pr-3 transition-colors hover:bg-bg/60">
                <Link
                  href={`/app/${project.id}`}
                  className="grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-6 gap-y-2 py-5 pl-6 sm:grid-cols-[minmax(0,1fr)_10rem_9rem_6rem]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg font-black tracking-tight transition-colors group-hover:text-accent">
                      {project.name}
                    </span>
                    <span className="block truncate font-sans text-xs text-muted">
                      {[project.type, !isOwnProject ? `de ${ownerLabel}` : null].filter(Boolean).join(" · ") ||
                        "Sin tipo todavía"}
                    </span>
                  </span>
                  <span className="justify-self-end sm:justify-self-start">
                    <StatusPill status={project.status} />
                  </span>
                  {p ? (
                    <span className="col-span-2 flex items-center gap-3 sm:col-span-1">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted">
                        {p.done}/{p.total}
                        <span className="sr-only"> pasos esenciales</span>
                      </span>
                    </span>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                  <span className="hidden text-right font-mono text-[11px] text-muted sm:block">
                    {project.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </Link>
                {isOwnProject ? (
                  <DeleteProjectButton projectName={project.name} action={deleteProject.bind(null, project.id)} />
                ) : (
                  <span className="w-8" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="tool-picker-title" className="mt-16">
        <h2 id="tool-picker-title" className="font-display text-xl font-black tracking-tight">
          Ir directo a una herramienta
        </h2>
        <p className="mt-1 max-w-xl font-sans text-sm text-muted">
          {projects.length > 1
            ? "Elige la herramienta y te preguntamos en qué proyecto antes de entrar."
            : "Elige la herramienta y entras directamente."}
        </p>
        <div className="mt-8">
          <ToolPickerGrid groups={TOOL_GROUPS} projects={projectOptions} />
        </div>
      </section>
    </div>
  );
}
