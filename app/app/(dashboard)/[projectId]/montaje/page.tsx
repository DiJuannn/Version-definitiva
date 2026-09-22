import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { prisma } from "@/lib/prisma";
import { getEditSelects } from "@/lib/edit-selects";
import { formatProjectCreditsText, getProjectCredits } from "@/lib/project-credits";
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
    prisma.editCut.findMany({ where: { projectId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
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
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Entrega"
        title="Montaje"
        description="La selección de tomas para quien monta, el registro de los cortes, la checklist de entrega y los créditos — todo a partir de lo que ya tiene el proyecto."
      />

      <div className="mt-8">
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
                    <p className="max-w-2xl font-sans text-sm text-muted">
                      Las tomas que marcaste como buenas durante el rodaje, por escena — {selects.scenesWithGood} de{" "}
                      {selects.scenesShot} escenas rodadas tienen ya alguna.
                    </p>
                    <div className="mt-6 border-t border-line">
                      {selects.scenes.map((scene) => (
                        <div key={scene.sceneNumber} className="border-b border-line py-4 last:border-b-0">
                          <p className="font-display text-base font-bold">
                            Escena {scene.sceneNumber}
                            {scene.context ? <span className="ml-2 font-mono text-xs text-muted">{scene.context}</span> : null}
                          </p>
                          {scene.shots.length === 0 ? (
                            <p className="mt-1 font-mono text-xs text-warn">Sin ninguna toma buena todavía.</p>
                          ) : (
                            <ul className="mt-2 space-y-2">
                              {scene.shots.map((shot) => (
                                <li key={shot.key} className="border-l-2 border-accent/40 pl-3">
                                  <p className="font-mono text-sm">
                                    {shot.label}
                                    {shot.size ? ` · ${shot.size}` : ""} —{" "}
                                    <span className="text-success">
                                      toma{shot.goodTakes.length === 1 ? "" : "s"} buena{shot.goodTakes.length === 1 ? "" : "s"}{" "}
                                      {shot.goodTakes.map((t) => t.take).join(", ")}
                                    </span>
                                  </p>
                                  {shot.description && <p className="font-sans text-xs text-muted">{shot.description}</p>}
                                  {shot.goodTakes
                                    .filter((t) => t.notes)
                                    .map((t, i) => (
                                      <p key={i} className="font-mono text-xs text-muted">
                                        Toma {t.take}: {t.notes}
                                      </p>
                                    ))}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
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
              content: <DeliveryChecklistPanel projectId={projectId} tasks={deliveryTasks} />,
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
                  <div className="flex items-center justify-between gap-4">
                    <p className="max-w-2xl font-sans text-sm text-muted">
                      Reparto y equipo técnico del proyecto, ordenados en el formato de los créditos de cierre.
                    </p>
                    <CopyTextButton text={creditsText} label="Copiar créditos" />
                  </div>
                  <pre className="mt-6 max-w-2xl overflow-x-auto whitespace-pre-wrap border border-line bg-bg-raised/40 p-5 font-mono text-sm leading-relaxed">
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
