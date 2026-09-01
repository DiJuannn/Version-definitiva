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
import { DeleteButton } from "@/components/DeleteButton";
import { HelpTip } from "@/components/HelpTip";
import { EmptyState } from "@/components/EmptyState";
import { ScriptUploadForm } from "@/components/ScriptUploadForm";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { BackLink } from "@/components/BackLink";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import { SCRIPT_ANALYSIS_FREE_LIMIT } from "@/lib/limits";
import { SparkleIcon } from "@/components/ToolIcons";

// El análisis de guion y la revisión de continuidad llaman a Mistral y
// pueden tardar más de los 10s que Vercel da por defecto a una función —
// sin esto, funcionaba en local (sin límite) pero fallaba en producción.
// Va aquí (la página) y no en el archivo "use server": un archivo de
// Server Actions solo puede exportar funciones async.
export const maxDuration = 60;

export default async function GuionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const profile = await getCurrentProfile();
  if (!profile) notFound();

  const [scriptFiles, scenes, pendingAnalyses, pendingContinuityChecks, analysisCount] =
    await Promise.all([
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
      prisma.scriptAnalysis.count({ where: { createdById: profile.id } }),
    ]);

  const uploadAction = uploadScript.bind(null, projectId);
  const createSceneAction = createScene.bind(null, projectId);
  const runContinuityAction = runContinuityCheck.bind(null, projectId);
  const isPro = profile.organization.plan === "PRO";
  const analysisLimitReached = !isPro && analysisCount >= SCRIPT_ANALYSIS_FREE_LIMIT;

  return (
    <div>
      <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Guion
      </h1>

      <section className="mt-8">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Archivo del guion
        </h2>
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
                    <DeleteButton className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent" />
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
                      ? "Sin límite con tu plan PRO."
                      : `Límite de ${SCRIPT_ANALYSIS_FREE_LIMIT} usos por cuenta, en total entre todos tus proyectos.`}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 border-t border-line pt-4">
                {analysisLimitReached ? (
                  <p className="font-mono text-xs text-muted">
                    Límite de tu cuenta usado ({SCRIPT_ANALYSIS_FREE_LIMIT}/
                    {SCRIPT_ANALYSIS_FREE_LIMIT}) —{" "}
                    <Link href="/app/organizacion" className="text-accent hover:underline">
                      pásate a PRO
                    </Link>{" "}
                    para uso ilimitado.
                  </p>
                ) : (
                  <>
                    <ActionButtonForm
                      action={analyzeScript.bind(null, projectId, scriptFiles[0].id)}
                      pendingLabel="Analizando…"
                      className="rounded-full border border-accent px-5 py-2 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
                    >
                      Analizar
                    </ActionButtonForm>
                    <span className="font-mono text-[10px] text-muted">
                      {isPro
                        ? "PRO · sin límite"
                        : `${analysisCount}/${SCRIPT_ANALYSIS_FREE_LIMIT} usos de tu cuenta`}
                    </span>
                  </>
                )}
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
      </section>

      <section className="mt-14">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
            Escenas
          </h2>
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

        <form
          action={createSceneAction}
          className="mt-4 flex max-w-sm gap-2"
        >
          <input
            name="number"
            placeholder="Número de escena (ej. 04)"
            required
            className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <SubmitButton
            pendingLabel="Creando…"
            savedLabel="✓ Creada"
            className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Crear
          </SubmitButton>
        </form>

        {scenes.length === 0 ? (
          <EmptyState
            title="Todavía no hay escenas"
            description="Crea la primera con el formulario de arriba."
          />
        ) : (
          <div className="mt-10 border-t border-line">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
              >
                <Link
                  href={`/app/${projectId}/guion/${scene.id}`}
                  className="min-w-0 flex-1"
                >
                  <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
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
                    className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                  />
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <div className="flex items-center gap-1.5">
          <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
            Continuidad
          </h2>
          <HelpTip text="La IA revisa personajes, atrezzo y vestuario de todas las escenas, en el orden en que ocurre la historia, y avisa de posibles inconsistencias (por ejemplo, un objeto marcado como roto que reaparece intacto). Solo señala — nunca cambia nada por su cuenta." />
        </div>
        <p className="mt-2 font-mono text-xs text-muted">
          Revisa las escenas en busca de inconsistencias de vestuario, atrezzo
          u otros detalles.
        </p>
        <div className="mt-4">
          <ActionButtonForm
            action={runContinuityAction}
            pendingLabel="Revisando…"
            className="rounded-full border border-accent px-4 py-1.5 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
          >
            Revisar continuidad
          </ActionButtonForm>
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
      </section>
    </div>
  );
}
