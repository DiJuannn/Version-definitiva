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
import { FormField } from "@/components/FormField";
import { ShotListUploadForm } from "@/components/ShotListUploadForm";

// El análisis del guion técnico llama a Mistral y puede tardar más de
// los 10s que Vercel da por defecto a una función.
export const maxDuration = 60;

const FIELD =
  "border border-line bg-transparent px-3 py-1.5 text-xs outline-none transition-colors focus:border-accent";
const ROW =
  "grid grid-cols-[4rem_1fr] items-baseline gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[4.5rem_5rem_9rem_9rem_1fr]";

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
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Lista de planos"
        description={
          scenes.length > 0
            ? `${shotCount} plano${shotCount === 1 ? "" : "s"} definido${shotCount === 1 ? "" : "s"} · ${scenesWithShots} de ${scenes.length} escenas con plano. Cada uno con su tamaño, ángulo y movimiento de cámara.`
            : undefined
        }
        actions={<PdfLink href={`/api/pdf/shot-list/${projectId}`} />}
      />

      <div className="mt-6 border border-line bg-bg-raised/40 p-4 print:hidden">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
          ¿Ya tienes un guion técnico escrito?
        </p>
        <p className="mt-1 text-sm text-muted">
          Súbelo (PDF o Word) y la IA propone los planos de cada escena, listos para revisar antes de añadirlos —
          sin teclearlos uno a uno. Si una escena no existe todavía, se crea.
        </p>
        <div className="mt-3">
          <ShotListUploadForm action={uploadAction} />
        </div>
      </div>

      {scenes.length === 0 ? (
        <EmptyState
          title="No hay escenas creadas todavía"
          description="Crea las escenas del proyecto en Guion, o sube tu guion técnico arriba para crearlas junto con sus planos."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : (
        <div className="mt-8 space-y-5">
          {scenes.map((scene) => {
            const createAction = createShot.bind(null, projectId, scene.id);
            const context = [
              INT_EXT_LABELS[scene.intExt],
              DAY_PART_LABELS[scene.dayPart],
              scene.location?.name,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <section key={scene.id} className="border border-line bg-bg-raised/40">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-4">
                  <h2 className="font-display text-lg font-bold">
                    Escena {scene.number}
                  </h2>
                  <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
                    {context}
                  </p>
                </div>

                {scene.shots.length > 0 && (
                  <div className="border-t border-line">
                    <div
                      className={`${ROW} hidden border-b border-line py-2 font-mono text-[10px] tracking-widest text-muted uppercase sm:grid`}
                    >
                      <span>Plano</span>
                      <span>Tamaño</span>
                      <span>Ángulo</span>
                      <span>Movimiento</span>
                      <span>Descripción</span>
                    </div>
                    <div className="divide-y divide-line">
                      {scene.shots.map((shot) => (
                        <Link
                          key={shot.id}
                          href={`/app/${projectId}/shot-list/${shot.id}`}
                          className={`group ${ROW} transition-colors hover:bg-accent/5`}
                        >
                          <span className="font-mono text-sm text-accent">
                            {scene.number}.{shot.number}
                          </span>
                          <span className="font-mono text-xs uppercase sm:text-sm">
                            {shot.shotSize ?? "—"}
                          </span>
                          <span className="hidden font-mono text-xs text-muted sm:block">
                            {shot.angle ?? "—"}
                          </span>
                          <span className="hidden font-mono text-xs text-muted sm:block">
                            {shot.movement ?? "—"}
                          </span>
                          <span className="col-span-2 font-mono text-xs text-muted transition-colors group-hover:text-fg sm:col-span-1">
                            {shot.description ?? ""}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <details className="group border-t border-line print:hidden">
                  <summary className="link-action cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="mr-1.5 inline-block transition-transform group-open:rotate-45">
                      +
                    </span>
                    Añadir plano
                  </summary>
                  <form action={createAction} className="flex flex-wrap gap-2 px-5 pb-5">
                    <FormField label="Nº plano">
            <input name="number"
                      required
                      className={`${FIELD} w-28`} />
          </FormField>
                    <FormField label="Tamaño">
            <input name="shotSize"
                      className={`${FIELD} w-44`}
                    
            placeholder="PG, PM, PP..." />
          </FormField>
                    <FormField label="Descripción">
            <input name="description"
                      className={`${FIELD} min-w-56 flex-1`} />
          </FormField>
                    <SubmitButton
                      pendingLabel="Añadiendo…"
                      savedLabel="✓ Añadido"
                      className="btn btn-secondary btn-sm"
                    >
                      Añadir plano
                    </SubmitButton>
                  </form>
                </details>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
