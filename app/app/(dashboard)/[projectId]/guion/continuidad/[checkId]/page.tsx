import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { updateContinuityIssueStatus } from "@/lib/actions/continuity";
import { ContinuityIssueStatus } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";

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

  const open = check.issues.filter((i) => i.status === "OPEN");
  const resolved = check.issues.filter((i) => i.status !== "OPEN");
  const confirmed = check.issues.filter((i) => i.status === "CONFIRMED").length;
  const dismissed = resolved.length - confirmed;

  const issueRow = (issue: (typeof check.issues)[number]) => (
    <li
      key={issue.id}
      className={`grid gap-x-8 gap-y-4 px-5 py-6 sm:px-7 md:grid-cols-[minmax(0,1fr)_auto] ${
        issue.status === "DISMISSED" ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="eyebrow text-accent">
          {TYPE_LABELS[issue.type] ?? issue.type}
          {issue.sceneNumbers.length > 0 && (
            <span className="text-muted">
              {" "}
              · {issue.sceneNumbers.length === 1 ? "Escena" : "Escenas"} {issue.sceneNumbers.join(", ")}
            </span>
          )}
        </p>
        <h2 className="mt-1.5 font-display text-lg leading-snug font-bold">{issue.title}</h2>
        <p className="mt-2 max-w-2xl font-sans text-[15px] leading-relaxed text-muted">{issue.description}</p>
      </div>

      <div className="flex items-start md:justify-end">
        {issue.status === "OPEN" ? (
          <div className="flex items-center gap-3">
            <form
              action={updateContinuityIssueStatus.bind(
                null,
                projectId,
                checkId,
                issue.id,
                ContinuityIssueStatus.CONFIRMED,
              )}
            >
              <button type="submit" className="btn btn-outline btn-sm">
                Es un fallo
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
              <button type="submit" className="link-action">
                Descartar
              </button>
            </form>
          </div>
        ) : issue.status === "CONFIRMED" ? (
          <span className="inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-success uppercase">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
            Confirmada
          </span>
        ) : (
          <span className="font-mono text-[11px] tracking-widest text-muted uppercase">Descartada</span>
        )}
      </div>
    </li>
  );

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/guion`}
        backLabel="← Guion"
        eyebrow="Guion · Continuidad"
        title="Revisión de continuidad"
        description="La IA ha comparado reparto, atrezzo y vestuario escena a escena, en el orden de la historia. Son avisos, no errores seguros: marca cada uno como fallo si lo es, o descártalo. Nada del proyecto cambia por esto."
      />

      {check.issues.length === 0 ? (
        <p className="mt-12 border-l-2 border-success pl-4 font-sans text-[15px]">
          Todo cuadra: no se han encontrado inconsistencias con los datos actuales.
        </p>
      ) : (
        <>
          <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
            {(
              [
                ["Por revisar", open.length, open.length > 0 ? "text-warn" : ""],
                ["Fallos confirmados", confirmed, ""],
                ["Descartadas", dismissed, "text-muted"],
              ] as const
            ).map(([label, n, tone]) => (
              <div key={label} className="flex items-baseline gap-2.5 border-l border-line pl-4 first:border-l-0 first:pl-0">
                <dd className={`font-display text-3xl font-black tabular-nums ${tone}`}>{n}</dd>
                <dt className="eyebrow text-muted">{label}</dt>
              </div>
            ))}
          </dl>

          {open.length > 0 && (
            <ol className="sheet mt-8 divide-y divide-line" aria-label="Por revisar">
              {open.map(issueRow)}
            </ol>
          )}

          {resolved.length > 0 && (
            <section className="mt-12" aria-labelledby="continuidad-revisadas">
              <h2 id="continuidad-revisadas" className="eyebrow text-muted">
                Ya revisadas
              </h2>
              <ol className="sheet mt-3 divide-y divide-line">{resolved.map(issueRow)}</ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
