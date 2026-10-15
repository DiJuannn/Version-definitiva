import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getScriptReport } from "@/lib/script-report";
import { PageHeader } from "@/components/PageHeader";
import { ScriptReport } from "@/components/ScriptReport";
import Link from "next/link";

export default async function ScriptPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const report = await getScriptReport(projectId);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
  }).format(new Date());

  return (
    <div>
      <PageHeader
        eyebrow="Rodar"
        title="Parte de script"
        description="Una hoja por día de rodaje con cada toma, su hora y su nota, y la buena rodeada como en el parte de la script. Se rellena solo con la claqueta."
        actions={
          <Link href={`/app/${projectId}/claqueta`} className="btn btn-outline">
            Ir a la claqueta
          </Link>
        }
      />
      <div className="mt-8">
        <ScriptReport projectId={projectId} initial={report} today={today} />
      </div>
      {report.days.length > 0 && (
        <p className="mt-16 border-t border-line pt-5 font-sans text-sm text-muted">
          Siguiente:{" "}
          <Link
            href={`/app/${projectId}/montaje`}
            className="font-medium text-fg underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
          >
            Montaje →
          </Link>{" "}
          — las tomas rodeadas pasan solas a la selección para quien monta.
        </p>
      )}
    </div>
  );
}
