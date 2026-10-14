import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/current-user";
import { listProjectsForProfile } from "@/lib/project-access";
import { createProjectAndOpenClaqueta } from "@/lib/actions/projects";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader
        eyebrow="Producción"
        title="Claqueta digital"
        description={
          projects.length === 0
            ? "La claqueta apunta cada toma en un proyecto. Crea el primero para empezar a usarla."
            : "¿Para qué proyecto es? Las tomas que marques quedan apuntadas en su parte de script."
        }
      />

      {projects.length === 0 ? (
        <div className="mt-10 max-w-md">
          <CreateProjectForm
            action={createProjectAndOpenClaqueta}
            formClassName="flex gap-2"
            inputClassName="field w-full py-2.5"
            buttonClassName="btn btn-primary shrink-0"
            buttonLabel="Crear y abrir"
            autoFocus
          />
        </div>
      ) : (
        <ul className="mt-10 max-w-2xl border-t border-line">
          {projects.map((project) => (
            <li key={project.id} className="border-b border-line">
              <Link
                href={`/app/${project.id}/claqueta`}
                className="group flex items-center gap-4 py-5"
              >
                <ClaquetaIcon className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-accent" />
                <span className="font-display text-xl font-bold transition-colors group-hover:text-accent">
                  {project.name}
                </span>
                <LinkPendingHint />
                <span
                  aria-hidden
                  className="ml-auto font-mono text-sm text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
