import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getScriptReport } from "@/lib/script-report";
import { PageHeader } from "@/components/PageHeader";
import { ScriptReport } from "@/components/ScriptReport";
import Link from "next/link";

export default async function ScriptPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const report = await getScriptReport(projectId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Producción"
        title="Parte de script"
        description="El parte de script: todas las tomas del rodaje, por día, escena y plano. Marca las buenas y anota lo que haga falta. Se rellena solo con la claqueta, o puedes apuntar tomas a mano."
        actions={
          <Link href={`/app/${projectId}/claqueta`} className="btn btn-outline">
            Ir a la claqueta
          </Link>
        }
      />
      <div className="mt-8">
        <ScriptReport projectId={projectId} initial={report} today={today} />
      </div>
    </div>
  );
}
