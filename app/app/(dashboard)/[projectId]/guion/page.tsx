import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createScene } from "@/lib/actions/scenes";
import { deleteScriptFile, uploadScript } from "@/lib/actions/script";
import { analyzeScript } from "@/lib/actions/script-analysis";
import { runContinuityCheck } from "@/lib/actions/continuity";
import { SubmitButton } from "@/components/SubmitButton";
import { HelpTip } from "@/components/HelpTip";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

export default async function GuionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scriptFiles, scenes, pendingAnalyses, pendingContinuityChecks] =
    await Promise.all([
      prisma.scriptFile.findMany({
        where: { projectId },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.scene.findMany({
        where: { projectId },
        orderBy: [{ order: "asc" }, { number: "asc" }],
        include: { location: true, _count: { select: { characters: true } } },
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

  return (
    <div>
      <Link
        href={`/app/${projectId}`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Guion
      </h1>

      <section className="mt-8">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Archivo del guion
        </h2>
        <form
          action={uploadAction}
          className="mt-4 flex flex-wrap items-center gap-3"
        >
          <input
            type="file"
            name="file"
            accept=".pdf,.doc,.docx"
            required
            className="font-mono text-xs text-muted"
          />
          <button
            type="submit"
            className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Subir
          </button>
        </form>

        {scriptFiles.length > 0 && (
          <div className="mt-4 border-t border-line">
            {scriptFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-4 border-b border-line py-3"
              >
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm text-fg hover:text-accent"
                >
                  {file.fileName}
                </a>
                <div className="flex items-center gap-4">
                  <form action={analyzeScript.bind(null, projectId, file.id)}>
                    <SubmitButton
                      pendingLabel="Analizando…"
                      className="rounded-full border border-accent px-4 py-1.5 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
                    >
                      Analizar con IA
                    </SubmitButton>
                  </form>
                  <form action={deleteScriptFile.bind(null, projectId, file.id)}>
                    <button
                      type="submit"
                      className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
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
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Escenas
        </h2>

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
          <button
            type="submit"
            className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Crear
          </button>
        </form>

        {scenes.length === 0 ? (
          <p className="mt-10 font-mono text-sm text-muted">
            Todavía no hay escenas. Crea la primera arriba.
          </p>
        ) : (
          <div className="mt-10 border-t border-line">
            {scenes.map((scene) => (
              <Link
                key={scene.id}
                href={`/app/${projectId}/guion/${scene.id}`}
                className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
              >
                <div>
                  <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                    Escena {scene.number}
                  </span>
                  <p className="font-mono text-xs text-muted">
                    {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
                    {scene.location ? ` · ${scene.location.name}` : ""}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted">
                  {scene._count.characters} personaje
                  {scene._count.characters === 1 ? "" : "s"}
                </span>
              </Link>
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
        <form action={runContinuityAction} className="mt-4">
          <SubmitButton
            pendingLabel="Revisando…"
            className="rounded-full border border-accent px-4 py-1.5 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg disabled:opacity-50"
          >
            Revisar continuidad
          </SubmitButton>
        </form>

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
