import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { prisma } from "@/lib/prisma";
import { getEditSelects } from "@/lib/edit-selects";
import {
  formatProjectCreditsText,
  getProjectCredits,
} from "@/lib/project-credits";
import { DELIVERY_CATEGORY } from "@/lib/delivery-checklist";
import { EDIT_CUT_STATUS_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { SectionTabs } from "@/components/SectionTabs";
import { EmptyState } from "@/components/EmptyState";
import { CopyTextButton } from "@/components/CopyTextButton";
import { EditCutsPanel } from "@/components/EditCutsPanel";
import { DeliveryChecklistPanel } from "@/components/DeliveryChecklistPanel";

export default async function MontajePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [isPro, selects, cuts, deliveryTasks, credits] = await Promise.all([
    isProjectOwnerPro(project.organizationId),
    getEditSelects(projectId),
    prisma.editCut.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.findMany({
      where: { projectId, category: DELIVERY_CATEGORY },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, status: true },
    }),
    getProjectCredits(projectId),
  ]);

  const creditsText = formatProjectCreditsText(credits);
  const deliveryDone = deliveryTasks.filter((t) => t.status === "DONE").length;
  const lastCut = cuts[cuts.length - 1];
  const scenesWithoutGood = selects.scenes
    .filter((s) => s.shots.length === 0)
    .map((s) => s.sceneNumber);
  const hasCredits = credits.cast.length > 0 || credits.crew.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Entrega"
        title="Montaje"
        description="Del rodaje a la entrega: las tomas buenas para quien monta, cada versión del montaje y lo que falta para entregar."
      />

      {/* Cómo voy: selección, versión actual y entrega, en una línea. */}
      <p className="mt-8 max-w-4xl font-sans text-[15px] leading-relaxed text-muted">
        {selects.scenesShot > 0 ? (
          <>
            <strong
              className={`font-semibold ${selects.scenesWithGood === selects.scenesShot ? "text-success" : "text-fg"}`}
            >
              {selects.scenesWithGood} de {selects.scenesShot} escenas rodadas
            </strong>{" "}
            con toma buena
          </>
        ) : (
          "Aún no hay tomas rodadas"
        )}
        {" · "}
        {lastCut ? (
          <>
            versión actual{" "}
            <strong className="font-semibold text-fg">
              v{cuts.length} {lastCut.name}
            </strong>{" "}
            ({EDIT_CUT_STATUS_LABELS[lastCut.status].toLowerCase()})
          </>
        ) : (
          "sin versiones apuntadas"
        )}
        {" · "}
        {deliveryTasks.length > 0 ? (
          <>
            entrega{" "}
            <strong
              className={`font-semibold ${deliveryDone === deliveryTasks.length ? "text-success" : "text-fg"}`}
            >
              {deliveryDone}/{deliveryTasks.length}
            </strong>
          </>
        ) : (
          "lista de entrega sin crear"
        )}
        .
      </p>

      {/* SectionTabs pega el panel a las pestañas en escritorio: aquí se le da aire. */}
      <div className="mt-10 lg:[&_[role=tabpanel]]:pt-6">
        <SectionTabs
          ariaLabel="Secciones de montaje"
          initial={tab ?? "seleccion"}
          tabs={[
            {
              id: "seleccion",
              label: "Selección",
              count: selects.scenesWithGood,
              content:
                selects.scenes.length === 0 ? (
                  <EmptyState
                    title="Todavía no hay tomas marcadas"
                    description="En cuanto marques tomas buenas con la claqueta (o a mano en el Parte de script), aparecen aquí agrupadas por escena, listas para pasarle a quien monta."
                  />
                ) : (
                  <div>
                    <p className="max-w-2xl font-sans text-[15px] leading-relaxed text-muted">
                      Las tomas rodeadas en el parte de script, por escena y
                      plano: es la lista que le pasas a quien monta.
                    </p>
                    {scenesWithoutGood.length > 0 && (
                      <p className="mt-4 border-l-2 border-warn pl-3 font-sans text-sm">
                        <span className="font-semibold text-warn">
                          Sin toma buena:
                        </span>{" "}
                        {scenesWithoutGood.length === 1 ? "escena" : "escenas"}{" "}
                        {scenesWithoutGood.join(", ")}.{" "}
                        <Link
                          href={`/app/${projectId}/script`}
                          className="text-accent underline-offset-4 hover:underline"
                        >
                          Rodéalas en el parte de script →
                        </Link>
                      </p>
                    )}
                    <ol className="sheet mt-6 divide-y divide-line px-5 sm:px-8">
                      {selects.scenes.map((scene) => (
                        <li
                          key={scene.sceneNumber}
                          className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-5 gap-y-2 py-5 sm:grid-cols-[4.5rem_12rem_minmax(0,1fr)]"
                        >
                          <p
                            className={`row-span-2 font-display text-4xl leading-none font-black tabular-nums sm:row-span-1 ${scene.shots.length === 0 ? "text-muted" : ""}`}
                          >
                            <span className="sr-only">Escena </span>
                            {scene.sceneNumber}
                          </p>
                          <p className="font-mono text-[11px] tracking-wider text-muted uppercase sm:pt-1">
                            {scene.context ?? "Escena " + scene.sceneNumber}
                          </p>
                          {scene.shots.length === 0 ? (
                            <p className="col-start-2 font-sans text-sm text-warn sm:col-start-auto">
                              Rodada, sin ninguna toma buena todavía.
                            </p>
                          ) : (
                            <ul className="col-start-2 divide-y divide-line sm:col-start-auto">
                              {scene.shots.map((shot) => (
                                <li
                                  key={shot.key}
                                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2 first:pt-0 last:pb-0"
                                >
                                  <div className="min-w-0">
                                    <p className="flex flex-wrap items-baseline gap-x-2">
                                      <span className="font-mono text-sm font-semibold">
                                        {shot.label}
                                      </span>
                                      {shot.size && (
                                        <span className="font-mono text-xs text-muted uppercase">
                                          {shot.size}
                                        </span>
                                      )}
                                    </p>
                                    {shot.description && (
                                      <p className="font-sans text-[13px] text-muted">
                                        {shot.description}
                                      </p>
                                    )}
                                    {shot.goodTakes
                                      .filter((t) => t.notes)
                                      .map((t, i) => (
                                        <p
                                          key={i}
                                          className="font-sans text-[13px] italic"
                                        >
                                          Toma {t.take}: {t.notes}
                                        </p>
                                      ))}
                                  </div>
                                  {/* Las tomas buenas, rodeadas como en el parte. */}
                                  <span
                                    className="flex gap-1.5"
                                    aria-label={`Tomas buenas: ${shot.goodTakes.map((t) => t.take).join(", ")}`}
                                  >
                                    {shot.goodTakes.map((t, i) => (
                                      <span
                                        key={i}
                                        aria-hidden
                                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-success font-mono text-sm font-bold text-success tabular-nums"
                                      >
                                        {t.take}
                                      </span>
                                    ))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                ),
            },
            {
              id: "cortes",
              label: "Versiones",
              count: cuts.length,
              content: (
                <EditCutsPanel
                  projectId={projectId}
                  cuts={cuts.map((c) => ({
                    id: c.id,
                    name: c.name,
                    durationLabel: c.durationLabel,
                    date: c.date ? c.date.toISOString() : null,
                    status: c.status,
                    notes: c.notes,
                  }))}
                />
              ),
            },
            {
              id: "entrega",
              label: "Entrega",
              count: deliveryTasks.length,
              content: (
                <DeliveryChecklistPanel
                  projectId={projectId}
                  tasks={deliveryTasks}
                />
              ),
            },
            {
              id: "creditos",
              label: "Créditos",
              content: !isPro ? (
                <EmptyState
                  title="Función de PRO"
                  description="Pásate a PRO para generar los créditos de cierre a partir del reparto y el equipo que ya tienes en el proyecto, ordenados y listos para copiar."
                  actionLabel="Ver planes"
                  actionHref="/app/organizacion"
                />
              ) : !hasCredits ? (
                <EmptyState
                  title="Todavía no hay a quién dar crédito"
                  description="Añade actores en Personajes y equipo técnico en Desglose, y aparecerán aquí ordenados y listos para copiar."
                />
              ) : (
                <div>
                  <div className="flex max-w-2xl flex-wrap items-center justify-between gap-4">
                    <p className="font-sans text-[15px] leading-relaxed text-muted">
                      Reparto y equipo técnico, en el orden de los créditos de
                      cierre. Cópialos y pégalos en el montaje.
                    </p>
                    <CopyTextButton
                      text={creditsText}
                      label="Copiar créditos"
                    />
                  </div>
                  {/* Como se verán: centrados, en una hoja. */}
                  <pre className="sheet mt-6 max-w-2xl overflow-x-auto px-6 py-10 text-center font-mono text-sm leading-loose whitespace-pre-wrap">
                    {creditsText}
                  </pre>
                </div>
              ),
            },
          ]}
        />
      </div>

      <p className="mt-16 border-t border-line pt-5 font-sans text-sm text-muted">
        Siguiente:{" "}
        <Link
          href={`/app/${projectId}/festivales`}
          className="font-medium text-fg underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          Festivales →
        </Link>{" "}
        — cuando la entrega esté lista.
      </p>
    </div>
  );
}
