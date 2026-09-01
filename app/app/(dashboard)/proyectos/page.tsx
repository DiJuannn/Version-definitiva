import Link from "next/link";
import { createProject, deleteProject } from "@/lib/actions/projects";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { SubmitButton } from "@/components/SubmitButton";
import { BackLink } from "@/components/BackLink";

export default async function ProyectosPage() {
  const profile = await getCurrentProfile();

  const projects = profile
    ? await prisma.project.findMany({
        where: {
          OR: [
            { organizationId: profile.organizationId },
            { shares: { some: { userId: profile.id } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          organization: { select: { name: true } },
          createdBy: { select: { fullName: true, email: true } },
        },
      })
    : [];

  return (
    <div>
      <BackLink href="/app">← Taller</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Proyectos
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Elige un proyecto para abrir su Taller, o crea uno nuevo.
      </p>

      <form action={createProject} className="mt-6 flex max-w-md gap-2">
        <input
          name="name"
          placeholder="Nombre del proyecto"
          required
          className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <SubmitButton
          pendingLabel="Creando…"
          className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-70"
        >
          Crear
        </SubmitButton>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          title="Todavía no hay proyectos"
          description="Crea el primero con el formulario de arriba."
        />
      ) : (
        <div className="mt-10 border-t border-line">
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
                    <span className="block font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                      {project.name}
                    </span>
                    {!isOwnProject && (
                      <span className="block font-mono text-[10px] text-muted">
                        Propietario: {ownerLabel}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <StatusPill status={project.status} />
                    <span className="font-mono text-xs text-muted">
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
    </div>
  );
}
