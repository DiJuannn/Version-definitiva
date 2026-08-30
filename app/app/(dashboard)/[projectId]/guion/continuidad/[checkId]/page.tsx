import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { updateContinuityIssueStatus } from "@/lib/actions/continuity";
import { FeatureIntro } from "@/components/FeatureIntro";
import { HelpTip } from "@/components/HelpTip";
import { ContinuityIssueStatus } from "@/lib/generated/prisma";

const TYPE_LABELS: Record<string, string> = {
  wardrobe: "Vestuario",
  prop: "Atrezzo",
  other: "Otro",
};

export default async function ContinuityCheckPage({
  params,
}: {
  params: Promise<{ projectId: string; checkId: string }>;
}) {
  const { projectId, checkId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const check = await prisma.continuityCheck.findFirst({
    where: { id: checkId, projectId },
    include: { issues: { orderBy: { createdAt: "asc" } } },
  });
  if (!check) notFound();

  return (
    <div>
      <Link
        href={`/app/${projectId}/guion`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Guion
      </Link>
      <div className="mt-3 flex items-center gap-1.5">
        <h1 className="font-display text-2xl font-bold uppercase">
          Revisión de continuidad
        </h1>
        <HelpTip text="La IA compara los personajes, atrezzo y vestuario de cada escena en el orden en que ocurre la historia, y señala posibles inconsistencias. Nunca cambia nada por su cuenta — cada alerta la confirmas o descartas tú." />
      </div>

      <FeatureIntro featureId="continuity-check">
        Esto son posibles inconsistencias, no errores confirmados. Revisa cada
        una: si es un problema real, pulsa &ldquo;Confirmar&rdquo; para
        recordarlo; si no aplica, pulsa &ldquo;Descartar&rdquo;. Nada del
        proyecto cambia solo por esto.
      </FeatureIntro>

      {check.issues.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          No se encontraron posibles inconsistencias con los datos actuales.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
          {check.issues.map((issue) => (
            <div key={issue.id} className="border border-line p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                    {TYPE_LABELS[issue.type] ?? issue.type}
                  </p>
                  <p className="mt-1 font-display text-base font-bold uppercase">
                    {issue.title}
                  </p>
                </div>
                {issue.status === "CONFIRMED" && (
                  <span className="shrink-0 font-mono text-[10px] tracking-widest text-accent uppercase">
                    ✓ Confirmada
                  </span>
                )}
                {issue.status === "DISMISSED" && (
                  <span className="shrink-0 font-mono text-[10px] tracking-widest text-muted uppercase">
                    Descartada
                  </span>
                )}
              </div>

              <p className="mt-3 font-mono text-sm text-fg">
                {issue.description}
              </p>

              {issue.sceneNumbers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {issue.sceneNumbers.map((number) => (
                    <span
                      key={number}
                      className="border border-line px-2 py-0.5 font-mono text-[10px] text-muted"
                    >
                      Escena {number}
                    </span>
                  ))}
                </div>
              )}

              {issue.status === "OPEN" && (
                <div className="mt-4 flex gap-4">
                  <form
                    action={updateContinuityIssueStatus.bind(
                      null,
                      projectId,
                      checkId,
                      issue.id,
                      ContinuityIssueStatus.CONFIRMED,
                    )}
                  >
                    <button
                      type="submit"
                      className="rounded-full border border-accent px-4 py-1.5 font-mono text-[11px] tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                    >
                      Confirmar
                    </button>
                  </form>
                  <form
                    action={updateContinuityIssueStatus.bind(
                      null,
                      projectId,
                      checkId,
                      issue.id,
                      ContinuityIssueStatus.DISMISSED,
                    )}
                  >
                    <button
                      type="submit"
                      className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                    >
                      Descartar
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
