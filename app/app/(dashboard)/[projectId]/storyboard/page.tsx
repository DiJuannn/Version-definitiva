import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { addStoryboardFrame, deleteStoryboardFrame } from "@/lib/actions/storyboard";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { PrintButton } from "@/components/PrintButton";
import { BackLink } from "@/components/BackLink";

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
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
        <PrintButton />
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Storyboard
      </h1>

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
              <h2 className="font-display text-lg font-bold uppercase">
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
                              className="absolute right-1 top-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 print:hidden"
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
                          <button
                            type="submit"
                            className="rounded-full bg-fg px-3 py-1.5 font-mono text-[11px] tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                          >
                            Añadir viñeta
                          </button>
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
