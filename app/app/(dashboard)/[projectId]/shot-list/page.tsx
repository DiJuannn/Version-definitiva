import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createShot } from "@/lib/actions/shots";
import { EmptyState } from "@/components/EmptyState";
import { PdfLink } from "@/components/PdfLink";

export default async function ShotListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { number: "asc" }],
    include: { shots: { orderBy: [{ order: "asc" }, { number: "asc" }] } },
  });

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/app/${projectId}`}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          ← {project.name}
        </Link>
        <PdfLink href={`/api/pdf/shot-list/${projectId}`} />
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Shot list
      </h1>

      {scenes.length === 0 ? (
        <EmptyState
          title="No hay escenas creadas todavía"
          description="Crea las escenas del proyecto en Guion antes de definir sus planos."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <div className="mt-10 space-y-10">
          {scenes.map((scene) => {
            const createAction = createShot.bind(null, projectId, scene.id);
            return (
              <section key={scene.id}>
                <h2 className="font-display text-lg font-bold uppercase">
                  Escena {scene.number}
                </h2>

                {scene.shots.length > 0 && (
                  <div className="mt-3 border-t border-line">
                    {scene.shots.map((shot) => (
                      <Link
                        key={shot.id}
                        href={`/app/${projectId}/shot-list/${shot.id}`}
                        className="group flex items-center justify-between gap-4 border-b border-line py-3 transition-colors hover:border-accent"
                      >
                        <span className="font-mono text-sm transition-colors group-hover:text-accent">
                          {scene.number}.{shot.number}
                          {shot.shotSize ? ` — ${shot.shotSize}` : ""}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {shot.description ?? ""}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}

                <form
                  action={createAction}
                  className="mt-3 flex flex-wrap gap-2 print:hidden"
                >
                  <input
                    name="number"
                    placeholder="Nº plano"
                    required
                    className="w-28 border border-line bg-transparent px-3 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  />
                  <input
                    name="shotSize"
                    placeholder="Tamaño (PG, PM, PP...)"
                    className="w-44 border border-line bg-transparent px-3 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  />
                  <input
                    name="description"
                    placeholder="Descripción"
                    className="min-w-56 flex-1 border border-line bg-transparent px-3 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                  >
                    Añadir plano
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
