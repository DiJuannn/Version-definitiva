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

// Storyboard: las viñetas son contenido visual, así que aquí sí van como
// tarjetas (losas), en una tira por plano. Cada plano es una fila: a la
// izquierda qué plano es, a la derecha sus viñetas y el hueco para añadir otra.

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
  const frameCount = scenesWithShots.reduce(
    (n, scene) => n + scene.shots.reduce((m, shot) => m + shot.storyboard.length, 0),
    0,
  );
  const shotCount = scenesWithShots.reduce((n, scene) => n + scene.shots.length, 0);
  const shotsWithFrames = scenesWithShots.reduce(
    (n, scene) => n + scene.shots.filter((shot) => shot.storyboard.length > 0).length,
    0,
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Storyboard"
        description="Una tira de viñetas por plano, escena a escena. Sube un dibujo o una foto de referencia y escribe qué pasa en cada viñeta."
        actions={scenesWithShots.length > 0 ? <PrintButton /> : undefined}
      />

      {scenesWithShots.length === 0 ? (
        <EmptyState
          title="Todavía no hay planos"
          description="El storyboard se dibuja plano a plano. Crea al menos un plano en la lista de planos para empezar."
          actionLabel="Ir a la lista de planos"
          actionHref={`/app/${projectId}/shot-list`}
        />
      ) : (
        <>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 print:hidden">
            <div className="flex items-baseline gap-2.5">
              <dd className="font-display text-3xl font-black tabular-nums">{frameCount}</dd>
              <dt className="eyebrow text-muted">{frameCount === 1 ? "viñeta" : "viñetas"}</dt>
            </div>
            <div className="flex items-baseline gap-2.5 border-l border-line pl-10">
              <dd className="font-display text-3xl font-black tabular-nums">
                {shotsWithFrames}
                <span className="text-muted">/{shotCount}</span>
              </dd>
              <dt className="eyebrow text-muted">planos con viñetas</dt>
            </div>
          </dl>

          <div className="mt-6 space-y-14">
            {scenesWithShots.map((scene) => (
              <section key={scene.id} aria-labelledby={`sb-${scene.id}`} className="border-t border-line pt-8">
                <h2 id={`sb-${scene.id}`} className="font-display text-xl font-bold">
                  Escena {scene.number}
                </h2>
                <div className="mt-6 space-y-10">
                  {scene.shots.map((shot) => {
                    const addAction = addStoryboardFrame.bind(null, projectId, shot.id);
                    return (
                      <div key={shot.id} className="grid gap-x-8 gap-y-3 md:grid-cols-[11rem_minmax(0,1fr)]">
                        <div>
                          <p className="font-mono text-sm font-medium text-accent tabular-nums">
                            {scene.number}.{shot.number}
                            {shot.shotSize && <span className="ml-2 text-muted uppercase">{shot.shotSize}</span>}
                          </p>
                          {shot.description && (
                            <p className="mt-1 font-sans text-sm leading-relaxed text-muted">{shot.description}</p>
                          )}
                        </div>

                        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
                          {shot.storyboard.map((frame, i) => (
                            <li key={frame.id} className="group relative">
                              <div className="tile flex aspect-video items-center justify-center overflow-hidden">
                                {frame.imageUrl ? (
                                  <Image
                                    src={frame.imageUrl}
                                    alt={frame.description ?? `Viñeta ${i + 1} del plano ${scene.number}.${shot.number}`}
                                    width={416}
                                    height={234}
                                    unoptimized
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
                                    Sin imagen
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 flex gap-2 font-sans text-[13px] leading-snug">
                                <span className="font-mono text-[11px] text-muted tabular-nums">{i + 1}</span>
                                <span className={frame.description ? "" : "text-muted"}>
                                  {frame.description ?? "Sin descripción"}
                                </span>
                              </p>
                              <form
                                action={deleteStoryboardFrame.bind(null, projectId, frame.id)}
                                className="absolute top-2 right-2 print:hidden [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100"
                              >
                                <DeleteButton
                                  confirmMessage="¿Eliminar esta viñeta del storyboard?"
                                  className="rounded-full bg-bg/85 px-3 py-1 font-mono text-[10px] tracking-widest text-fg uppercase backdrop-blur hover:text-danger"
                                />
                              </form>
                            </li>
                          ))}

                          <li className="print:hidden">
                            <details className="group/add relative">
                              <summary className="flex aspect-video cursor-pointer list-none flex-col items-center justify-center gap-1 rounded-xl text-muted ring-1 ring-line transition-colors ring-inset hover:text-fg hover:ring-accent [&::-webkit-details-marker]:hidden">
                                <span aria-hidden className="text-2xl leading-none transition-transform group-open/add:rotate-45">
                                  +
                                </span>
                                <span className="font-mono text-[10px] tracking-widest uppercase">Añadir viñeta</span>
                              </summary>
                              <form
                                action={addAction}
                                className="sheet absolute top-full left-0 z-30 mt-2 grid w-[min(18rem,calc(100vw-2rem))] gap-4 p-4 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)]"
                              >
                                <label className="flex flex-col gap-1.5">
                                  <span className="eyebrow text-muted">Imagen (opcional)</span>
                                  <input
                                    type="file"
                                    name="image"
                                    accept="image/*"
                                    className="font-sans text-xs text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:tracking-widest file:text-fg file:uppercase"
                                  />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                  <span className="eyebrow text-muted">Qué pasa</span>
                                  <input name="description" placeholder="Elena cierra la claqueta" className="field" />
                                </label>
                                <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadida" className="btn btn-primary">
                                  Añadir viñeta
                                </SubmitButton>
                              </form>
                            </details>
                          </li>
                        </ol>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
