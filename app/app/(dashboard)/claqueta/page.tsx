import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/current-user";
import { listProjectsForProfile } from "@/lib/project-access";
import { createProjectAndOpenClaqueta } from "@/lib/actions/projects";
import { BackLink } from "@/components/BackLink";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { LinkPendingHint } from "@/components/LinkPendingHint";
import { ClaquetaIcon } from "@/components/ToolIcons";

// Punto de entrada de la Claqueta sin proyecto todavía elegido — al que
// llega quien la abre desde Inicio sin tener ningún proyecto (o con
// varios, para elegir cuál). Con exactamente un proyecto no hace falta
// preguntar nada, se entra directo.
export default async function ClaquetaEntryPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/app/login");

  const projects = await listProjectsForProfile(profile);

  if (projects.length === 1) {
    redirect(`/app/${projects[0].id}/claqueta`);
  }

  return (
    <div>
      <BackLink href="/app">← Taller</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Claqueta digital
      </h1>

      {projects.length === 0 ? (
        <>
          <p className="mt-2 font-mono text-xs text-muted">
            La claqueta cuelga de un proyecto — crea el primero para
            empezar a usarla.
          </p>
          <div className="mt-6 max-w-md">
            <CreateProjectForm
              action={createProjectAndOpenClaqueta}
              formClassName="flex gap-2"
              inputClassName="w-full border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
              buttonClassName="shrink-0 rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-70"
              buttonLabel="Crear y abrir"
              autoFocus
            />
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 font-mono text-xs text-muted">
            Elige para qué proyecto es.
          </p>
          <div className="mt-6 border-t border-line">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/${project.id}/claqueta`}
                className="group flex items-center gap-3 border-b border-line py-4 transition-colors hover:border-accent"
              >
                <ClaquetaIcon className="h-5 w-5 shrink-0 text-accent" />
                <span className="font-display text-base font-bold uppercase transition-colors group-hover:text-accent">
                  {project.name}
                </span>
                <LinkPendingHint />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
