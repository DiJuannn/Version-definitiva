import Link from "next/link";
import { createProject, deleteProject } from "@/lib/actions/projects";
import { getCurrentProfile } from "@/lib/current-user";
import { listProjectsForProfile } from "@/lib/project-access";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { ToolPickerGrid } from "@/components/ToolPickerGrid";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GROUPS } from "@/lib/tool-groups";

export default async function ProyectosPage() {
  const profile = await getCurrentProfile();

  const projects = profile ? await listProjectsForProfile(profile) : [];
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        title="Proyectos"
        description="Todos tus proyectos. Entra en uno para ver su hoja de ruta y sus herramientas, o salta directo a una herramienta más abajo."
      />

      <div className="mt-8 max-w-md">
        <CreateProjectForm
          action={createProject}
          formClassName="flex gap-2"
          inputClassName="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          buttonClassName="btn btn-primary shrink-0"
          buttonLabel="Nuevo proyecto"
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          title="Todavía no hay proyectos"
          description="Ponle nombre al primero y entra: te guiaremos paso a paso desde el guion hasta el rodaje."
        />
      ) : (
        <div className="mt-8 border-t border-line">
          {projects.map((project) => {
            const isOwnProject = project.organizationId === profile?.organizationId;
            const ownerLabel =
              project.createdBy?.fullName ??
              project.createdBy?.email ??
              project.organization.name;
            return (
              <div
                key={project.id}
                className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
              >
                <Link
                  href={`/app/${project.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-bold transition-colors group-hover:text-accent">
                      {project.name}
                    </span>
                    {!isOwnProject && (
                      <span className="block font-mono text-[11px] text-muted">
                        Propietario: {ownerLabel}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <StatusPill status={project.status} />
                    <span className="hidden font-mono text-xs text-muted sm:inline">
                      {project.createdAt.toLocaleDateString("es-ES")}
                    </span>
                  </span>
                </Link>
                {isOwnProject && (
                  <DeleteProjectButton
                    projectName={project.name}
                    action={deleteProject.bind(null, project.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-14 border-t border-line pt-8">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
          Ir directo a una herramienta
        </p>
        <p className="mt-2 max-w-xl font-sans text-sm text-muted">
          Elige la herramienta y, si tienes varios proyectos, te preguntamos
          cuál antes de entrar.
        </p>
        <div className="mt-6">
          <ToolPickerGrid groups={TOOL_GROUPS} projects={projectOptions} />
        </div>
      </div>
    </div>
  );
}
