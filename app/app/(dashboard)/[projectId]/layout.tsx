import type { ReactNode } from "react";
import { ProjectPhaseNav } from "@/components/ProjectPhaseNav";
import { ProjectBreadcrumb } from "@/components/ProjectBreadcrumb";
import { ClaquetaFab } from "@/components/ClaquetaFab";
import { ScenePeek } from "@/components/ScenePeek";
import { PhaseScope } from "@/components/PhaseScope";
import { ProjectPresence } from "@/components/ProjectPresence";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser, listProjectsForProfile } from "@/lib/project-access";
import { getProjectFacts, getToolMode } from "@/lib/tool-access";
import { computeAccess, computeStage } from "@/lib/tool-rules";

// La autorización real (¿este proyecto es de tu organización o te lo
// compartieron?) la hace cada página con getProjectForCurrentUser — aquí solo
// se lee el nombre y la lista de proyectos para pintar las migas.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const profile = await getCurrentProfile();
  // Todo a la vez (antes eran dos rondas seguidas): si el proyecto no es
  // accesible, los datos de las herramientas simplemente no se usan.
  const [project, projects, factsIfAny, modeIfAny] = profile
    ? await Promise.all([
        getProjectForCurrentUser(projectId),
        listProjectsForProfile(profile),
        getProjectFacts(projectId),
        getToolMode(profile.organizationId),
      ])
    : [null, [], null, "full" as const];
  // Qué herramientas se enseñan: las que ya sirven en este proyecto (o todas en modo completo).
  const facts = project ? factsIfAny : null;
  const mode = project ? modeIfAny : ("full" as const);
  const access = facts ? computeAccess(facts) : {};
  const stage = facts ? computeStage(facts) : 1;

  return (
    <PhaseScope stage={stage}>
      {/* Cabecera del proyecto en negro, a todo el ancho, pegada a la barra
          de arriba: es parte del marco. Debajo empieza la herramienta. */}
      <div className="taller-ink -mt-8 mx-[calc(50%-50vw)] bg-bg px-[calc(50vw-50%)] pt-3 text-fg print:hidden sm:-mt-12">
        <ProjectPhaseNav
          projectId={projectId}
          stage={stage}
          access={access}
          mode={mode}
          lead={
            project && (
              <ProjectBreadcrumb
                compact
                projectId={projectId}
                projectName={project.name}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              />
            )
          }
          trailing={profile && <ProjectPresence projectId={projectId} userId={profile.id} userLabel={profile.fullName ?? profile.email} />}
        />
      </div>
      <div className="mt-8 sm:mt-10">{children}</div>
      {project && <ScenePeek projectId={projectId} />}
      {(mode === "full" || access.claqueta?.unlocked !== false) && <ClaquetaFab projectId={projectId} />}
    </PhaseScope>
  );
}
