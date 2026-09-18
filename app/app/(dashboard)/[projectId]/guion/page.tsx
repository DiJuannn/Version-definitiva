import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { createScene, deleteAllScenes, deleteScene } from "@/lib/actions/scenes";
import { DangerConfirmButton } from "@/components/DangerConfirmButton";
import { deleteScriptFile, uploadScript } from "@/lib/actions/script";
import { analyzeScript } from "@/lib/actions/script-analysis";
import { runContinuityCheck } from "@/lib/actions/continuity";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { isPro as isProPlan } from "@/lib/plan";
import { DeleteButton } from "@/components/DeleteButton";
import { HelpTip } from "@/components/HelpTip";
import { EmptyState } from "@/components/EmptyState";
import { ScriptUploadForm } from "@/components/ScriptUploadForm";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { PageHeader } from "@/components/PageHeader";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import {
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
} from "@/lib/limits";
import { SparkleIcon } from "@/components/ToolIcons";
import { SectionTabs } from "@/components/SectionTabs";

// El análisis de guion y la revisión de continuidad llaman a Mistral y
// pueden tardar más de los 10s que Vercel da por defecto a una función —
// sin esto, funcionaba en local (sin límite) pero fallaba en producción.
// Va aquí (la página) y no en el archivo "use server": un archivo de
// Server Actions solo puede exportar funciones async.
export const maxDuration = 60;

export default async function GuionPage({
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

  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const [scriptFiles, scenes, pendingAnalyses, pendingContinuityChecks] = await Promise.all([
    prisma.scriptFile.findMany({
      where: { projectId },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        location: { select: { name: true } },
        _count: { select: { characters: true } },
      },
    }),
    prisma.scriptAnalysis.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.continuityCheck.findMany({
      where: { projectId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { issues: true } } },
    }),
  ]);

  const uploadAction = uploadScript.bind(null, projectId);
  const createSceneAction = createScene.bind(null, projectId);
  const runContinuityAction = runContinuityCheck.bind(null, projectId);
  const isPro = isProPlan(profile.organization.plan);
  const isProjectPro = await isProjectOwnerPro(project.organizationId);

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Guion"
      />

      <div className="mt-8">
        <SectionTabs
          ariaLabel="Secciones del guion"
          initial={tab ?? (scenes.length > 0 ? "escenas" : "archivo")}
          tabs={[
            {
              id: "escenas",
              label: "Escenas",
              count: scenes.length,
              content: (
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-4">
                            <form
                              action={createSceneAction}
                              className="flex w-full max-w-sm items-end gap-2"
                            >
                              <FormField label="Número de escena" className="w-full">
                                <input name="number"
                                required
                                className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          
                                placeholder="04" />
                              </FormField>
                              <SubmitButton
                                pendingLabel="Creando…"
                                savedLabel="✓ Creada"
                                className="btn btn-secondary shrink-0"
                              >
                                Crear
                              </SubmitButton>
                            </form>
                              {scenes.length > 0 && (
                                <DangerConfirmButton
                                  trigger="Eliminar todas"
                                  triggerClassName="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
                                  title="¿Eliminar todas las escenas?"
                                  description={`Se borrarán las ${scenes.length} escenas de este proyecto, junto con su reparto, desglose y equipo asignados a cada una. El guion subido, los personajes, las localizaciones y el desglose en sí no se tocan. Esta acción no se puede deshacer.`}
                                  action={deleteAllScenes.bind(null, projectId)}
                                />
                              )}
                  </div>
                          {scenes.length === 0 ? (
                            <EmptyState
                              title="Todavía no hay escenas"
                              description="Crea la primera con el formulario de arriba."
                            />
                          ) : (
                            <div className="mt-6 border-t border-line">
                              {scenes.map((scene) => (
                                <div
                                  key={scene.id}
                                  className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
                                >
                                  <Link
                                    href={`/app/${projectId}/guion/${scene.id}`}
                                    className="min-w-0 flex-1"
                                  >
                                    <span className="font-display text-lg font-bold transition-colors group-hover:text-accent">
                                      Escena {scene.number}
                                    </span>
                                    <p className="font-mono text-xs text-muted">
                                      {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
                                      {scene.location ? ` · ${scene.location.name}` : ""}
                                    </p>
                                  </Link>
                                  <span className="shrink-0 font-mono text-xs text-muted">
                                    {scene._count.characters} personaje
                                    {scene._count.characters === 1 ? "" : "s"}
                                  </span>
                                  <form
                                    action={deleteScene.bind(null, projectId, scene.id)}
                                    className="shrink-0"
                                  >
                                    <DeleteButton
                                      confirmMessage="¿Eliminar esta escena?"
                                      className="link-action"
                                    />
                                  </form>
                                </div>
                              ))}
                            </div>
                          )}
                </div>
              ),
            },
            {
              id: "archivo",
              label: "Archivo del guion",
              count: scriptFiles.length,
              alert: pendingAnalyses.length > 0,
              content: (
                <div>
                          <div className="mt-4">
                            <ScriptUploadForm
                              action={uploadAction}
                              existingFileName={scriptFiles[0]?.fileName ?? null}
                            />
                          </div>

                          {scriptFiles.length > 0 && (
                            <>
                              <div className="mt-4 border-t border-line">
                                {scriptFiles.map((file) => (
                                  <div
                                    key={file.id}
                                    className="flex items-center justify-between gap-4 border-b border-line py-3"
                                  >
                                    <FileOpenLink
                                      href={file.fileUrl}
                                      className="font-mono text-sm text-fg hover:text-accent"
                                    >
                                      {file.fileName}
                                    </FileOpenLink>
                                    <form action={deleteScriptFile.bind(null, projectId, file.id)}>
                                      <DeleteButton className="link-action" />
                                    </form>
                                  </div>
                                ))}
                              </div>

                              {/* Tarjeta propia para Analizar — mismo peso visual que la
                                  Claqueta digital del inicio, en vez de ir apretado junto al
                                  nombre del archivo compitiendo con "Eliminar". */}
                              <div className="mt-6 border border-line p-5">
                                <div className="flex items-start gap-3">
                                  <SparkleIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-mono text-xs tracking-widest uppercase">
                                        Analizar guion
                                      </p>
                                      <HelpTip text="Se lee el PDF de tu guion y te lleva a una pantalla de revisión con lo que se propone. Tú decides qué importar de verdad — no se crea ni se cambia nada hasta que lo confirmes." />
                                    </div>
                                    <p className="mt-1 font-mono text-xs text-muted">
                                      Lee el guion y propone escenas, personajes, localizaciones
                                      y atrezzo a partir de él.{" "}
                                      {isPro
                                        ? `Hasta ${SCRIPT_ANALYSIS_PRO_DAILY_LIMIT} análisis al día.`
                                        : `${SCRIPT_ANALYSIS_FREE_DAILY_LIMIT} análisis al día, ${SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT} en total con el plan gratuito.`}
                                    </p>
                                  </div>
                                </div>

                                <div className="mt-4 border-t border-line pt-4">
                                  <ActionButtonForm
                                    action={analyzeScript.bind(null, projectId, scriptFiles[0].id)}
                                    pendingLabel="Analizando…"
                                    className="btn btn-outline"
                                  >
                                    Analizar
                                  </ActionButtonForm>
                                </div>
                              </div>
                            </>
                          )}

                          {pendingAnalyses.length > 0 && (
                            <div className="mt-4 border-t border-line">
                              {pendingAnalyses.map((analysis) => (
                                <Link
                                  key={analysis.id}
                                  href={`/app/${projectId}/guion/analisis/${analysis.id}`}
                                  className="flex items-center justify-between border-b border-line py-3 font-mono text-sm hover:text-accent"
                                >
                                  Análisis pendiente de revisar —{" "}
                                  {analysis.createdAt.toLocaleString("es-ES")}
                                  <span>Revisar →</span>
                                </Link>
                              ))}
                            </div>
                          )}
                </div>
              ),
            },
            {
              id: "continuidad",
              label: "Continuidad",
              alert: pendingContinuityChecks.length > 0,
              content: (
                <div>
                  <div className="flex items-start gap-1.5">
                    <p className="font-mono text-xs text-muted">
                      Revisa las escenas en busca de inconsistencias de vestuario, atrezzo u otros detalles.
                    </p>
                    <HelpTip text="La IA revisa personajes, atrezzo y vestuario de todas las escenas, en el orden en que ocurre la historia, y avisa de posibles inconsistencias (por ejemplo, un objeto marcado como roto que reaparece intacto). Solo señala — nunca cambia nada por su cuenta." />
                  </div>
                  <div className="mt-4">
                            {isProjectPro ? (
                              <ActionButtonForm
                                action={runContinuityAction}
                                pendingLabel="Revisando…"
                                className="btn btn-outline btn-sm"
                              >
                                Revisar continuidad
                              </ActionButtonForm>
                            ) : (
                              <Link
                                href="/app/organizacion"
                                className="btn btn-outline btn-sm inline-flex"
                              >
                                Revisar continuidad — solo PRO
                              </Link>
                            )}
                          </div>

                          {pendingContinuityChecks.length > 0 && (
                            <div className="mt-4 border-t border-line">
                              {pendingContinuityChecks.map((check) => (
                                <Link
                                  key={check.id}
                                  href={`/app/${projectId}/guion/continuidad/${check.id}`}
                                  className="flex items-center justify-between border-b border-line py-3 font-mono text-sm hover:text-accent"
                                >
                                  Revisión pendiente — {check._count.issues} alerta
                                  {check._count.issues === 1 ? "" : "s"} —{" "}
                                  {check.createdAt.toLocaleString("es-ES")}
                                  <span>Revisar →</span>
                                </Link>
                              ))}
                            </div>
                          )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
