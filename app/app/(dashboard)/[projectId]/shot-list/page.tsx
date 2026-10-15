import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { analyzeShotList } from "@/lib/actions/shot-list-import";
import { EmptyState } from "@/components/EmptyState";
import { PdfLink } from "@/components/PdfLink";
import { PageHeader } from "@/components/PageHeader";
import { ShotBuilder } from "@/components/preproduccion/ShotBuilder";
import { courierPrime } from "@/lib/screenplay/font";
import { getScenesText } from "@/lib/scene-text";
import { PlanosTabs } from "@/components/preproduccion/PlanosTabs";
import { TechnicalScript } from "@/components/preproduccion/TechnicalScript";
import { PrintButton } from "@/components/PrintButton";
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
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ escena?: string; vista?: string }>;
}) {
  const { projectId } = await params;
  const { escena, vista } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { number: "asc" }],
    include: {
      location: { select: { name: true } },
      characters: { select: { character: { select: { id: true, name: true } } }, orderBy: { character: { name: "asc" } } },
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
    missing.length === 0
      ? ""
      : missing.length === 1
      ? `falta la ${missing[0].number}`
      : `faltan la ${missing
          .slice(0, -1)
          .map((s) => s.number)
          .join(", ")} y la ${missing[missing.length - 1].number}`;

  // Planificar una escena: el texto a un lado y el constructor de planos al otro.
  const planning = escena ? scenes.find((s) => s.id === escena) : undefined;
  if (planning) {
    const index = scenes.indexOf(planning);
    const texts = await getScenesText(projectId, [planning]);
    const text = texts.get(planning.id);
    const nextNumber =
      Math.max(0, ...planning.shots.map((sh) => Number.parseInt(sh.number, 10)).filter(Number.isFinite)) + 1;
    const prev = scenes[index - 1];
    const next = scenes[index + 1];
    const href = (id: string) => `/app/${projectId}/shot-list?escena=${id}`;
    return (
      <div className={`pb-16 ${courierPrime.variable}`}>
        <PageHeader
          backHref={`/app/${projectId}/shot-list`}
          backLabel="← Lista de planos"
          eyebrow={`Planificar · escena ${index + 1} de ${scenes.length}`}
          title={`Escena ${planning.number}`}
          description={
            <>
              <SceneSlug intExt={planning.intExt} dayPart={planning.dayPart} location={planning.location?.name} />
              <span className="ml-2">
                · {planning.shots.length} {planning.shots.length === 1 ? "plano" : "planos"}
                {planning.characters.length > 0 && ` · ${planning.characters.map((c) => c.character.name).join(", ")}`}
              </span>
            </>
          }
          actions={
            <>
              {prev && (
                <Link href={href(prev.id)} className="link-action">
                  ← Escena {prev.number}
                </Link>
              )}
              {next && (
                <Link href={href(next.id)} className="btn btn-outline btn-sm">
                  Escena {next.number} →
                </Link>
              )}
            </>
          }
        />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-8 lg:sticky lg:top-28 lg:self-start">
            <section aria-labelledby="pl-texto">
              <h2 id="pl-texto" className="eyebrow">La escena</h2>
              <div className="paper mt-3 max-h-[46vh] overflow-y-auto px-6 py-5 font-[family-name:var(--font-courier)] text-[13.5px] leading-[1.55]">
                {text && text.blocks.length > 0 ? (
                  text.blocks.map((b, i) => (
                    <p
                      key={i}
                      className={`whitespace-pre-wrap ${
                        b.type === "character" ? "mt-3 ml-[30%] uppercase" : b.type === "dialogue" ? "mx-[14%]" : b.type === "parenthetical" ? "ml-[24%]" : "mt-3 first:mt-0"
                      }`}
                    >
                      {b.text}
                    </p>
                  ))
                ) : (
                  <p className="font-sans text-sm text-muted">Esta escena no tiene texto todavía.</p>
                )}
              </div>
            </section>
            <section aria-labelledby="pl-planos">
              <h2 id="pl-planos" className="eyebrow">Planos de la escena · {planning.shots.length}</h2>
              {planning.shots.length === 0 ? (
                <p className="mt-3 font-sans text-sm text-muted">Aún ninguno. Empieza por una cobertura →</p>
              ) : (
                <ol className="mt-3 divide-y divide-line">
                  {planning.shots.map((sh) => (
                    <li key={sh.id}>
                      <Link href={`/app/${projectId}/shot-list/${sh.id}`} className="group flex items-center gap-3 py-2">
                        <ShotFrame size={sh.shotSize} className="h-9 w-16 shrink-0" />
                        <span className="w-10 font-mono text-[12px] font-semibold">
                          {planning.number}.{sh.number}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-sans text-sm group-hover:text-accent">
                          {sh.description ?? <span className="text-muted">Sin descripción</span>}
                        </span>
                        <span className="font-sans text-[12px] text-muted">{[sh.angle, sh.movement].filter(Boolean).join(" · ")}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
          <ShotBuilder
            key={planning.id}
            projectId={projectId}
            sceneId={planning.id}
            sceneNumber={planning.number}
            place={planning.location?.name ?? null}
            characters={planning.characters.map((c) => c.character)}
            nextNumber={nextNumber}
          />
        </div>
      </div>
    );
  }

  // El guion técnico: todo el guion seguido, con los planos de cada escena.
  if (vista === "tecnico") {
    const texts = await getScenesText(projectId, scenes);
    return (
      <div className={`print-doc pb-16 ${courierPrime.variable}`}>
        <div className="print-hide">
          <PageHeader
            eyebrow="Preparar"
            title="Guion técnico"
            description="El guion completo, escena a escena, con cómo se rueda cada una al lado. Para leerlo de corrido o imprimirlo."
            actions={scenes.length > 0 ? <PrintButton label="Imprimir" /> : undefined}
          />
          <PlanosTabs projectId={projectId} active="tecnico" />
        </div>
        <h1 className="mb-4 hidden font-[family-name:var(--font-courier)] text-xl font-bold uppercase print:block">
          {project.name} · Guion técnico
        </h1>
        {scenes.length === 0 ? (
          <EmptyState
            title="Todavía no hay escenas"
            description="El guion técnico se arma con las escenas del guion y sus planos."
            actionLabel="Ir a Guion"
            actionHref={`/app/${projectId}/guion`}
          />
        ) : (
          <>
            {missing.length > 0 && (
              <p className="print-hide mt-6 border-l-2 border-warn py-0.5 pl-4 font-sans text-[15px]">
                <strong className="font-semibold">
                  {scenesWithShots} de {scenes.length} escenas tienen planos · {missingText}.
                </strong>
              </p>
            )}
            <TechnicalScript projectId={projectId} scenes={scenes} texts={texts} />
          </>
        )}
      </div>
    );
  }

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
              <Link href={`/app/${projectId}/shot-list?escena=${missing[0].id}`} className="eyebrow text-accent hover:underline">
                Planificar la {missing[0].number} →
              </Link>
            </p>
          )}

          <div className="mt-10 space-y-12">
            {scenes.map((scene) => {
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

                    <div className={`px-4 py-3.5 sm:px-6 print:hidden ${scene.shots.length > 0 ? "border-t border-line" : ""}`}>
                      <Link href={`/app/${projectId}/shot-list?escena=${scene.id}`} className="link-action !px-0 text-accent hover:!text-accent">
                        + {scene.shots.length ? "Añadir planos" : "Planificar"} a la escena {scene.number}
                      </Link>
                    </div>
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
