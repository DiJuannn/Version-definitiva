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
  const hasCredits = credits.cast.length > 0 || credits.crew.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Entrega"
        title="Montaje"
        description="Lo que necesita quien monta y lo que falta para entregar: las tomas buenas, las versiones del montaje, la lista de entrega y los créditos. Todo sale de lo que ya tiene el proyecto."
      />

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
                      Las tomas que marcaste como buenas en el rodaje, por
                      escena: es lo que le pasas a quien monta.{" "}
                      <span className="text-fg">
                        {selects.scenesWithGood} de {selects.scenesShot} escenas
                        rodadas
                      </span>{" "}
                      tienen ya alguna.
                    </p>
                    <ol className="sheet mt-6 divide-y divide-line px-5 sm:px-8">
                      {selects.scenes.map((scene) => (
                        <li
                          key={scene.sceneNumber}
                          className="grid gap-x-8 gap-y-2 py-5 sm:grid-cols-[11rem_1fr]"
                        >
                          <div>
                            <p className="font-display text-lg font-bold">
                              Escena {scene.sceneNumber}
                            </p>
                            {scene.context && (
                              <p className="font-sans text-sm text-muted">
                                {scene.context}
                              </p>
                            )}
                          </div>
                          {scene.shots.length === 0 ? (
                            <p className="border-l-2 border-warn pl-3 font-sans text-sm text-warn">
                              Sin ninguna toma buena todavía.
                            </p>
                          ) : (
                            <ul className="space-y-3">
                              {scene.shots.map((shot) => (
                                <li key={shot.key}>
                                  <p className="flex flex-wrap items-baseline gap-x-3">
                                    <span className="font-mono text-sm text-accent">
                                      {shot.label}
                                    </span>
                                    {shot.size && (
                                      <span className="font-mono text-xs uppercase">
                                        {shot.size}
                                      </span>
                                    )}
                                    <span className="font-sans text-sm font-semibold text-success">
                                      ✓ toma
                                      {shot.goodTakes.length === 1
                                        ? ""
                                        : "s"}{" "}
                                      {shot.goodTakes
                                        .map((t) => t.take)
                                        .join(", ")}
                                    </span>
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
              label: "Cortes",
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
    </div>
  );
}
