import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { addStoryboardFrame, deleteStoryboardFrame } from "@/lib/actions/storyboard";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";

export default async function StoryboardPage({
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
    include: {
      shots: {
        orderBy: [{ order: "asc" }, { number: "asc" }],
        include: { storyboard: { orderBy: { order: "asc" } } },
      },
    },
  });

  const scenesWithShots = scenes.filter((scene) => scene.shots.length > 0);

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Storyboard"
        description="Viñetas de los planos clave, escena por escena."
        actions={<PrintButton />}
      />

      {scenesWithShots.length === 0 ? (
        <EmptyState
          title="Todavía no hay planos creados"
          description="Define al menos un plano en Shot list para poder dibujar su storyboard."
          actionLabel="Ir a Shot list"
          actionHref={`/app/${projectId}/shot-list`}
        />
      ) : (
        <div className="mt-10 space-y-12">
          {scenesWithShots.map((scene) => (
            <section key={scene.id}>
              <h2 className="font-display text-lg font-bold">
                Escena {scene.number}
              </h2>
              <div className="mt-4 space-y-8">
                {scene.shots.map((shot) => {
                  const addAction = addStoryboardFrame.bind(
                    null,
                    projectId,
                    shot.id,
                  );
                  return (
                    <div key={shot.id}>
                      <p className="font-mono text-xs text-muted">
                        Plano {scene.number}.{shot.number}
                        {shot.description ? ` — ${shot.description}` : ""}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-4">
                        {shot.storyboard.map((frame) => (
                          <div key={frame.id} className="group relative">
                            <div className="flex aspect-video w-56 items-center justify-center border border-line bg-bg-raised">
                              {frame.imageUrl ? (
                                <Image
                                  src={frame.imageUrl}
                                  alt=""
                                  width={224}
                                  height={126}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="font-mono text-[10px] text-muted">
                                  Sin imagen
                                </span>
                              )}
                            </div>
                            {frame.description && (
                              <p className="mt-1 w-56 font-mono text-[11px] text-muted">
                                {frame.description}
                              </p>
                            )}
                            <form
                              action={deleteStoryboardFrame.bind(
                                null,
                                projectId,
                                frame.id,
                              )}
                              className="absolute right-1 top-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity group-hover:opacity-100 focus-within:opacity-100 print:hidden"
                            >
                              <DeleteButton
                                confirmMessage="¿Eliminar esta viñeta del storyboard?"
                                className="bg-bg/80 px-2 py-1 font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
                              />
                            </form>
                          </div>
                        ))}

                        <form
                          action={addAction}
                          className="flex w-56 flex-col gap-2 border border-dashed border-line p-3 print:hidden"
                        >
                          <input
                            type="file"
                            name="image"
                            accept="image/*"
                            className="font-mono text-[11px] text-muted"
                          />
                          <input
                            name="description"
                            placeholder="Descripción"
                            className="border border-line bg-transparent px-2 py-1 text-xs outline-none transition-colors focus:border-accent"
                          />
                          <SubmitButton
                            pendingLabel="Añadiendo…"
                            savedLabel="✓ Añadida"
                            className="btn btn-secondary btn-sm"
                          >
                            Añadir viñeta
                          </SubmitButton>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
