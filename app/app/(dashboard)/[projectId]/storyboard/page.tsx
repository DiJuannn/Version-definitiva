import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { addStoryboardFrame, deleteStoryboardFrame } from "@/lib/actions/storyboard";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { PrintButton } from "@/components/PrintButton";
import { PageHeader } from "@/components/PageHeader";
import { PlanosTabs } from "@/components/preproduccion/PlanosTabs";
import { SubmitButton } from "@/components/SubmitButton";
import { NextTool, SceneSlug } from "@/components/preproduccion/SceneSlug";
import { ShotFrame } from "@/components/preproduccion/ShotFrame";

// Storyboard como se dibuja en papel: una tira de viñetas 16:9 por escena,
// en orden, numeradas escena.plano (con letra si un plano tiene varias:
// 1.2a, 1.2b) y la descripción debajo. Los planos sin dibujo también ocupan
// su viñeta, vacía, con el pictograma de su encuadre y la invitación a
// añadir imagen: así se ve qué falta sin buscarlo.

const ADD_FORM =
  "paper absolute top-full left-0 z-30 mt-2 grid w-[min(18rem,calc(100vw-2rem))] gap-4 p-5 text-left";

function AddFrameForm({ action, label }: { action: (formData: FormData) => void | Promise<void>; label: string }) {
  return (
    <form action={action} className={ADD_FORM} aria-label={label}>
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
  );
}

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
      location: { select: { name: true } },
      shots: {
        orderBy: [{ order: "asc" }, { number: "asc" }],
        include: { storyboard: { orderBy: { order: "asc" } } },
      },
    },
  });

  const scenesWithShots = scenes.filter((scene) => scene.shots.length > 0);
  const scenesWithoutShots = scenes.filter((scene) => scene.shots.length === 0);
  const frameCount = scenesWithShots.reduce(
    (n, scene) => n + scene.shots.reduce((m, shot) => m + shot.storyboard.length, 0),
    0,
  );
  const imagelessCount = scenesWithShots.reduce(
    (n, scene) => n + scene.shots.reduce((m, shot) => m + shot.storyboard.filter((f) => !f.imageUrl).length, 0),
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
        eyebrow="Preparar"
        title="Storyboard"
        description="La película dibujada antes de rodarla: una viñeta por plano, escena a escena. Sube un dibujo o una foto de referencia y escribe qué pasa."
        actions={scenesWithShots.length > 0 ? <PrintButton /> : undefined}
      />
      <PlanosTabs projectId={projectId} active="storyboard" />

      {scenesWithShots.length === 0 ? (
        <EmptyState
          title="Todavía no hay planos"
          description="El storyboard se dibuja plano a plano. Crea al menos un plano en la lista de planos para empezar."
          actionLabel="Ir a la lista de planos"
          actionHref={`/app/${projectId}/shot-list`}
        />
      ) : (
        <>
          {/* ------------------------------------------------ cómo voy */}
          <dl className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-3 print:hidden">
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">
                {shotsWithFrames}
                <span className="text-muted">/{shotCount}</span>
              </dd>
              <dt className="font-sans text-sm text-muted">planos dibujados</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">{frameCount}</dd>
              <dt className="font-sans text-sm text-muted">{frameCount === 1 ? "viñeta" : "viñetas"}</dt>
            </div>
            {imagelessCount > 0 && (
              <div className="flex items-baseline gap-2 sm:border-l sm:border-line sm:pl-8">
                <dd className="font-display text-2xl leading-none font-black tabular-nums">{imagelessCount}</dd>
                <dt className="font-sans text-sm text-muted">sin imagen todavía</dt>
              </div>
            )}
          </dl>
          {scenesWithoutShots.length > 0 && (
            <p className="mt-6 border-l-2 border-warn py-0.5 pl-4 font-sans text-[15px] print:hidden">
              <strong className="font-semibold">
                {scenesWithoutShots.length === 1
                  ? `La escena ${scenesWithoutShots[0].number} no tiene planos`
                  : `Las escenas ${scenesWithoutShots.map((s) => s.number).join(", ")} no tienen planos`}
                , así que no salen aquí.
              </strong>{" "}
              <Link href={`/app/${projectId}/shot-list`} className="text-accent hover:underline">
                Añadirlos en la lista de planos →
              </Link>
            </p>
          )}

          <div className="mt-10 space-y-14">
            {scenesWithShots.map((scene) => {
              const drawn = scene.shots.filter((sh) => sh.storyboard.length > 0).length;
              return (
                <section key={scene.id} aria-labelledby={`sb-${scene.id}`} className="break-inside-avoid">
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b border-line pb-3">
                    <h2 id={`sb-${scene.id}`} className="flex min-w-0 items-baseline gap-4">
                      <span className="font-display text-3xl leading-none font-black tabular-nums">{scene.number}</span>
                      <SceneSlug
                        intExt={scene.intExt}
                        dayPart={scene.dayPart}
                        location={scene.location?.name}
                        className="text-[15px] sm:text-base"
                      />
                    </h2>
                    <span className="font-sans text-sm text-muted">
                      {drawn}/{scene.shots.length} planos dibujados
                    </span>
                  </div>

                  <ol className="mt-5 grid grid-cols-1 gap-x-5 gap-y-7 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {scene.shots.flatMap((shot) => {
                      const code = `${scene.number}.${shot.number}`;
                      const addAction = addStoryboardFrame.bind(null, projectId, shot.id);
                      if (shot.storyboard.length === 0) {
                        return [
                          <li key={shot.id} className="print:hidden">
                            <details className="group/add relative">
                              <summary className="relative block aspect-video cursor-pointer list-none overflow-hidden rounded-xl text-muted ring-1 ring-line transition ring-inset hover:text-fg hover:ring-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                                <ShotFrame
                                  size={shot.shotSize}
                                  title=""
                                  className="absolute inset-0 rounded-none bg-transparent opacity-[0.13] ring-0"
                                />
                                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-fg/70 group-hover/add:text-fg">
                                  <span aria-hidden className="text-2xl leading-none transition-transform group-open/add:rotate-45">
                                    +
                                  </span>
                                  <span className="font-mono text-[10px] tracking-widest uppercase">
                                    Añadir imagen al {code}
                                  </span>
                                </span>
                              </summary>
                              <AddFrameForm action={addAction} label={`Añadir viñeta al plano ${code}`} />
                            </details>
                            <p className="mt-2.5 flex gap-2.5 font-sans text-[13px] leading-snug">
                              <span className="shrink-0 font-mono text-[12px] font-bold text-fg tabular-nums">{code}</span>
                              <span className="text-muted">{shot.description ?? "Sin descripción"}</span>
                            </p>
                          </li>,
                        ];
                      }
                      const many = shot.storyboard.length > 1;
                      return shot.storyboard.map((frame, i) => {
                        const label = many ? `${code}${String.fromCharCode(97 + i)}` : code;
                        const isLast = i === shot.storyboard.length - 1;
                        return (
                          <li key={frame.id} className="group relative">
                            <div className="relative aspect-video overflow-hidden rounded-xl bg-bg-raised ring-1 ring-fg/10">
                              {frame.imageUrl ? (
                                <Image
                                  src={frame.imageUrl}
                                  alt={frame.description ?? `Viñeta ${label}`}
                                  width={416}
                                  height={234}
                                  unoptimized
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <>
                                  <ShotFrame
                                    size={shot.shotSize}
                                    title=""
                                    className="absolute inset-0 rounded-none bg-transparent opacity-25 ring-0"
                                  />
                                  <span className="absolute bottom-2 left-2.5 font-mono text-[10px] tracking-widest text-muted uppercase">
                                    Sin imagen
                                  </span>
                                </>
                              )}
                              <span className="absolute top-2 left-2 rounded-md bg-bg/85 px-2 py-0.5 font-mono text-[12px] font-bold text-fg tabular-nums backdrop-blur">
                                {label}
                                {shot.shotSize && (
                                  <span className="ml-1.5 font-normal text-muted uppercase">{shot.shotSize}</span>
                                )}
                              </span>
                            </div>
                            <p className="mt-2.5 font-sans text-[13px] leading-snug">
                              <span className={frame.description ? "" : "text-muted"}>
                                {frame.description ?? shot.description ?? "Sin descripción"}
                              </span>
                            </p>
                            {isLast && (
                              <details className="group/add relative mt-1.5 print:hidden">
                                <summary className="link-action cursor-pointer list-none text-accent [&::-webkit-details-marker]:hidden">
                                  <span aria-hidden className="mr-1 inline-block transition-transform group-open/add:rotate-45">
                                    +
                                  </span>
                                  Otra viñeta del {code}
                                </summary>
                                <AddFrameForm action={addAction} label={`Añadir viñeta al plano ${code}`} />
                              </details>
                            )}
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
                        );
                      });
                    })}
                  </ol>
                </section>
              );
            })}
          </div>

          <NextTool
            href={`/app/${projectId}/plan-de-rodaje`}
            label="Plan de rodaje"
            hint="Reparte las escenas y sus planos en días."
          />
        </>
      )}
    </div>
  );
}
