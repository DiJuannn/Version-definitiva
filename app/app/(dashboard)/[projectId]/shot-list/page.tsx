import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createShot } from "@/lib/actions/shots";
import { analyzeShotList } from "@/lib/actions/shot-list-import";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";
import { PdfLink } from "@/components/PdfLink";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { ShotListUploadForm } from "@/components/ShotListUploadForm";

// El análisis del guion técnico llama a Mistral y puede tardar más de
// los 10s que Vercel da por defecto a una función.
export const maxDuration = 60;

// La lista de planos es una sola hoja: cada escena es un grupo con su
// encabezado y sus planos en filas (antes, una caja por escena con su propia
// cabecera de tabla). Añadir un plano se despliega en la propia escena.

const ROW =
  "grid grid-cols-[3.5rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 px-5 sm:grid-cols-[4rem_4.5rem_8rem_8rem_minmax(0,1fr)] sm:px-7";

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
      shots: { orderBy: [{ order: "asc" }, { number: "asc" }] },
    },
  });
  const shotCount = scenes.reduce((n, s) => n + s.shots.length, 0);
  const scenesWithShots = scenes.filter((s) => s.shots.length > 0).length;
  const uploadAction = analyzeShotList.bind(null, projectId);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Lista de planos"
        description="Los planos de cada escena: tamaño, ángulo y movimiento de cámara. ¿Ya tienes el guion técnico escrito? Impórtalo (PDF o Word) y la IA propone los planos para que los revises."
        actions={
          <>
            <ShotListUploadForm action={uploadAction} />
            <PdfLink href={`/api/pdf/shot-list/${projectId}`} />
          </>
        }
      />

      {scenes.length === 0 ? (
        <EmptyState
          title="Todavía no hay escenas"
          description="Los planos cuelgan de las escenas. Créalas en Guion, o importa el guion técnico y se crearán junto con sus planos."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            <div className="flex items-baseline gap-2.5">
              <dd className="font-display text-3xl font-black tabular-nums">{shotCount}</dd>
              <dt className="eyebrow text-muted">{shotCount === 1 ? "plano" : "planos"}</dt>
            </div>
            <div className="flex items-baseline gap-2.5 border-l border-line pl-10">
              <dd className="font-display text-3xl font-black tabular-nums">
                {scenesWithShots}
                <span className="text-muted">/{scenes.length}</span>
              </dd>
              <dt className="eyebrow text-muted">escenas con planos</dt>
            </div>
          </dl>

          <div className="sheet mt-8 overflow-hidden">
            <div
              className={`${ROW} hidden border-b border-line py-3 font-mono text-[10px] tracking-widest text-muted uppercase sm:grid`}
              aria-hidden
            >
              <span>Plano</span>
              <span>Tamaño</span>
              <span>Ángulo</span>
              <span>Movimiento</span>
              <span>Descripción</span>
            </div>

            {scenes.map((scene) => {
              const createAction = createShot.bind(null, projectId, scene.id);
              return (
                <section
                  key={scene.id}
                  aria-labelledby={`esc-${scene.id}`}
                  className="border-t border-line [&:nth-child(2)]:border-t-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-6 pb-2 sm:px-7">
                    <h2 id={`esc-${scene.id}`} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-display text-lg font-bold">Escena {scene.number}</span>
                      <span className="font-mono text-[12px] tracking-wide text-muted uppercase">
                        {INT_EXT_LABELS[scene.intExt]}. {scene.location?.name ?? "Sin localización"} —{" "}
                        {DAY_PART_LABELS[scene.dayPart]}
                      </span>
                    </h2>
                    <span className="font-mono text-[11px] text-muted">
                      {scene.shots.length === 0
                        ? "Sin planos"
                        : `${scene.shots.length} plano${scene.shots.length === 1 ? "" : "s"}`}
                    </span>
                  </div>

                  {scene.shots.length > 0 && (
                    <ul className="divide-y divide-line">
                      {scene.shots.map((shot) => (
                        <li key={shot.id}>
                          <Link
                            href={`/app/${projectId}/shot-list/${shot.id}`}
                            className={`group ${ROW} py-3 transition-colors hover:bg-accent/[0.05] focus-visible:bg-accent/[0.08] focus-visible:outline-none`}
                          >
                            <span className="font-mono text-sm font-medium text-accent tabular-nums">
                              {scene.number}.{shot.number}
                            </span>
                            <span className="font-mono text-xs uppercase sm:text-sm">
                              {shot.shotSize ?? <span className="text-muted">—</span>}
                              <span className="font-sans text-muted normal-case sm:hidden">
                                {[shot.angle, shot.movement].filter(Boolean).length > 0 &&
                                  ` · ${[shot.angle, shot.movement].filter(Boolean).join(" · ")}`}
                              </span>
                            </span>
                            <span className="hidden font-sans text-sm text-muted sm:block">{shot.angle ?? "—"}</span>
                            <span className="hidden font-sans text-sm text-muted sm:block">{shot.movement ?? "—"}</span>
                            <span className="col-start-2 font-sans text-sm transition-colors group-hover:text-fg sm:col-start-auto">
                              {shot.description ?? ""}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  <details className="group/add px-5 pb-4 sm:px-7 print:hidden">
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
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
