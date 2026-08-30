import Link from "next/link";
import { createProject } from "@/lib/actions/projects";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState } from "@/components/EmptyState";

export default async function ProyectosPage() {
  const profile = await getCurrentProfile();

  const projects = profile
    ? await prisma.project.findMany({
        where: { organizationId: profile.organizationId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
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
        <button
          type="submit"
          className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Crear
        </button>
      </form>

      {projects.length === 0 ? (
        <EmptyState
          title="Todavía no hay proyectos"
          description="Crea el primero con el formulario de arriba."
        />
      ) : (
        <div className="mt-10 border-t border-line">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/app/${project.id}`}
              className="group flex items-center justify-between border-b border-line py-4 transition-colors hover:border-accent"
            >
              <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                {project.name}
              </span>
              <span className="flex items-center gap-4">
                <StatusPill status={project.status} />
                <span className="font-mono text-xs text-muted">
                  {project.createdAt.toLocaleDateString("es-ES")}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
