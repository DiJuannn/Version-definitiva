import Link from "next/link";
import { createProject } from "@/lib/actions/projects";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function ProyectosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.user.findUnique({ where: { id: user.id } })
    : null;

  const projects = profile
    ? await prisma.project.findMany({
        where: { organizationId: profile.organizationId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <Link
        href="/taller"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Proyectos
      </h1>

      <form
        action={createProject}
        className="mt-6 flex max-w-md gap-2"
      >
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
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay proyectos. Crea el primero arriba.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between border-b border-line py-4"
            >
              <span className="font-display text-lg font-bold uppercase">
                {project.name}
              </span>
              <span className="font-mono text-xs text-muted">
                {project.createdAt.toLocaleDateString("es-ES")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
