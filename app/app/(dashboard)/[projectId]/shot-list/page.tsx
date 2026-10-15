import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createShot } from "@/lib/actions/shots";
import { analyzeShotList } from "@/lib/actions/shot-list-import";
import { EmptyState } from "@/components/EmptyState";
import { PdfLink } from "@/components/PdfLink";
import { PageHeader } from "@/components/PageHeader";
import { PlanosTabs } from "@/components/preproduccion/PlanosTabs";
import { SubmitButton } from "@/components/SubmitButton";
import { ShotListUploadForm } from "@/components/ShotListUploadForm";
import { NextTool, SceneSlug } from "@/components/preproduccion/SceneSlug";
import {
  AngleIcon,
  MovementIcon,
  SHOT_SIZE_NAMES,
  ShotFrame,
  shotSizeKind,
  type ShotSizeKind,
} from "@/components/preproduccion/ShotFrame";

// El análisis del guion técnico llama a Mistral y puede tardar más de
// los 10s que Vercel da por defecto a una función.
export const maxDuration = 60;

// La lista de planos como un guion técnico: escena a escena (encabezado en
// Courier, como en el guion), y cada plano con su encuadre dibujado según el
// tamaño (PG, PA, PM, PP, PD…), iconos de ángulo y movimiento y si ya está
// rodado. Así se lee la planificación de una escena sin leer una sola
// palabra. Añadir un plano se despliega en la propia escena.

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
    include: {
      location: { select: { name: true } },
      shots: {
        orderBy: [{ order: "asc" }, { number: "asc" }],
        include: { _count: { select: { storyboard: true } } },
      },
    },
  });
  const shotCount = scenes.reduce((n, s) => n + s.shots.length, 0);
  const scenesWithShots = scenes.filter((s) => s.shots.length > 0).length;
  const missing = scenes.filter((s) => s.shots.length === 0);
  const doneCount = scenes.reduce((n, s) => n + s.shots.filter((sh) => sh.done).length, 0);
  const plannedCount = scenes.reduce((n, s) => n + s.shots.filter((sh) => sh.shootingDayId).length, 0);
  const uploadAction = analyzeShotList.bind(null, projectId);
  const missingText =
    missing.length === 1
      ? `falta la ${missing[0].number}`
      : `faltan la ${missing
          .slice(0, -1)
          .map((s) => s.number)
          .join(", ")} y la ${missing[missing.length - 1].number}`;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preparar"
        title="Lista de planos"
        description="Cómo se va a rodar cada escena, plano a plano: encuadre, ángulo y movimiento. ¿Ya tienes el guion técnico? Impórtalo y la IA propone los planos."
        actions={
          <>
            <ShotListUploadForm action={uploadAction} />
            <PdfLink href={`/api/pdf/shot-list/${projectId}`} />
          </>
        }
      />
      <PlanosTabs projectId={projectId} active="lista" />

      {scenes.length === 0 ? (
        <EmptyState
          title="Todavía no hay escenas"
          description="Los planos cuelgan de las escenas. Créalas en Guion, o importa el guion técnico y se crearán junto con sus planos."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <>
          {/* ------------------------------------------------ cómo voy */}
          <dl className="mt-9 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">{shotCount}</dd>
              <dt className="font-sans text-sm text-muted">{shotCount === 1 ? "plano" : "planos"}</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">
                {scenesWithShots}
                <span className="text-muted">/{scenes.length}</span>
              </dd>
              <dt className="font-sans text-sm text-muted">escenas planificadas</dt>
            </div>
            <div className="flex items-baseline gap-2 sm:border-l sm:border-line sm:pl-8">
              <dd className="font-display text-2xl leading-none font-black text-success tabular-nums">{doneCount}</dd>
              <dt className="font-sans text-sm text-muted">{doneCount === 1 ? "rodado" : "rodados"}</dt>
            </div>
            <div className="flex items-baseline gap-2">
              <dd className="font-display text-2xl leading-none font-black tabular-nums">{plannedCount}</dd>
              <dt className="font-sans text-sm text-muted">con día de rodaje</dt>
            </div>
          </dl>
          {missing.length > 0 && (
            <p className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-l-2 border-warn py-0.5 pl-4 font-sans text-[15px]">
              <span>
                <strong className="font-semibold">
                  {scenesWithShots} de {scenes.length} escenas tienen planos · {missingText}.
                </strong>{" "}
                <span className="text-muted">Sin planos no se puede repartir la escena en el plan de rodaje.</span>
              </span>
              <a href={`#esc-${missing[0].id}`} className="eyebrow text-accent hover:underline">
                Planificar la {missing[0].number} →
              </a>
            </p>
          )}

          <div className="mt-10 space-y-12">
            {scenes.map((scene) => {
              const createAction = createShot.bind(null, projectId, scene.id);
              return (
                <section key={scene.id} aria-labelledby={`esc-${scene.id}-t`} id={`esc-${scene.id}`} className="scroll-mt-32">
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 pb-3">
                    <h2 id={`esc-${scene.id}-t`} className="flex min-w-0 items-baseline gap-4">
                      <span className="font-display text-3xl leading-none font-black tabular-nums">{scene.number}</span>
                      <SceneSlug
                        intExt={scene.intExt}
                        dayPart={scene.dayPart}
                        location={scene.location?.name}
                        className="text-[15px] sm:text-base"
                      />
                    </h2>
                    <span className={`font-sans text-sm ${scene.shots.length === 0 ? "text-warn" : "text-muted"}`}>
                      {scene.shots.length === 0
                        ? "Sin planos todavía"
                        : `${scene.shots.length} plano${scene.shots.length === 1 ? "" : "s"}`}
                    </span>
                  </div>

                  <div className="sheet overflow-hidden">
                    {scene.shots.length > 0 && (
                      <ul className="divide-y divide-line">
                        {scene.shots.map((shot) => {
                          const kind = shotSizeKind(shot.shotSize);
                          return (
                            <li key={shot.id}>
                              <Link
                                href={`/app/${projectId}/shot-list/${shot.id}`}
                                className="group grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-4 py-3.5 transition-colors hover:bg-accent/[0.05] focus-visible:bg-accent/[0.07] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:grid-cols-[7rem_3.5rem_minmax(0,1fr)_13rem_6.5rem] sm:gap-x-5 sm:px-6"
                              >
                                <ShotFrame size={shot.shotSize} className={shot.done ? "opacity-60" : ""} />
                                <span className="hidden font-display text-xl font-black tabular-nums group-hover:text-accent sm:block">
                                  {scene.number}.{shot.number}
                                </span>
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-baseline gap-x-2">
                                    <span className="font-display text-base font-black tabular-nums group-hover:text-accent sm:hidden">
                                      {scene.number}.{shot.number}
                                    </span>
                                    <span className="font-sans text-sm font-semibold">
                                      {kind ? SHOT_SIZE_NAMES[kind] : (shot.shotSize ?? "Sin tamaño")}
                                    </span>
                                    {shot.shotSize && (
                                      <span className="font-mono text-[11px] text-muted uppercase">{shot.shotSize}</span>
                                    )}
                                  </span>
                                  {shot.description && (
                                    <span className="mt-0.5 block font-sans text-sm leading-snug text-muted">
                                      {shot.description}
                                    </span>
                                  )}
                                  {/* En móvil, cámara y estado debajo de la descripción. */}
                                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-muted sm:hidden">
                                    {shot.angle && (
                                      <span className="flex items-center gap-1">
                                        <AngleIcon angle={shot.angle} className="h-3.5 w-3.5" />
                                        {shot.angle}
                                      </span>
                                    )}
                                    {shot.movement && (
                                      <span className="flex items-center gap-1">
                                        <MovementIcon movement={shot.movement} className="h-3.5 w-3.5" />
                                        {shot.movement}
                                      </span>
                                    )}
                                    {shot.done && <span className="font-medium text-success">✓ Rodado</span>}
                                  </span>
                                </span>
                                <span className="hidden space-y-1 font-sans text-[13px] text-muted sm:block">
                                  <span className="flex items-center gap-2">
                                    <AngleIcon angle={shot.angle} className="h-4 w-4 shrink-0 text-fg/80" />
                                    {shot.angle ?? <span className="opacity-50">Ángulo —</span>}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <MovementIcon movement={shot.movement} className="h-4 w-4 shrink-0 text-fg/80" />
                                    {shot.movement ?? <span className="opacity-50">Movimiento —</span>}
                                  </span>
                                </span>
                                <span className="hidden text-right font-sans text-xs sm:block">
                                  {shot.done ? (
                                    <span className="font-semibold text-success">✓ Rodado</span>
                                  ) : shot.shootingDayId ? (
                                    <span className="text-fg/80">Con día</span>
                                  ) : (
                                    <span className="text-muted">Por rodar</span>
                                  )}
                                  {shot._count.storyboard > 0 && (
                                    <span className="mt-1 block text-muted">
                                      {shot._count.storyboard} viñeta{shot._count.storyboard === 1 ? "" : "s"}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <details className={`group/add px-4 py-4 sm:px-6 print:hidden ${scene.shots.length > 0 ? "border-t border-line" : ""}`}>
                      <summary className="link-action cursor-pointer list-none text-accent hover:text-accent [&::-webkit-details-marker]:hidden">
                        <span aria-hidden className="mr-1.5 inline-block transition-transform group-open/add:rotate-45">
                          +
                        </span>
                        Añadir plano a la escena {scene.number}
                      </summary>
                      <form
                        action={createAction}
                        className="mt-3 grid gap-3 sm:grid-cols-[6rem_9rem_minmax(0,1fr)_auto] sm:items-end"
                      >
                        <label className="flex flex-col gap-1.5">
                          <span className="eyebrow text-muted">Nº plano</span>
                          <input name="number" required placeholder={String(scene.shots.length + 1)} className="field" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="eyebrow text-muted">Tamaño</span>
                          <input name="shotSize" placeholder="PG, PM, PP…" className="field" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="eyebrow text-muted">Descripción</span>
                          <input name="description" placeholder="Qué se ve en el plano" className="field" />
                        </label>
                        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-secondary">
                          Añadir
                        </SubmitButton>
                      </form>
                    </details>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Leyenda de tamaños: los pictogramas, con su nombre. */}
          <section aria-labelledby="sl-leyenda" className="mt-14">
            <h2 id="sl-leyenda" className="eyebrow">
              Tamaños de plano
            </h2>
            <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-5 lg:grid-cols-9">
              {(Object.keys(SHOT_SIZE_NAMES) as ShotSizeKind[]).map((k) => (
                <li key={k}>
                  <ShotFrame size={k} />
                  <p className="mt-1.5 font-sans text-xs leading-tight text-muted">
                    <span className="font-mono text-fg">{k}</span> · {SHOT_SIZE_NAMES[k]}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <NextTool
            href={`/app/${projectId}/storyboard`}
            label="Storyboard"
            hint="Dibuja o sube una viñeta para los planos clave."
          />
        </>
      )}
    </div>
  );
}
