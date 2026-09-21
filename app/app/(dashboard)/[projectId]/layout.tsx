import type { ReactNode } from "react";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { ProjectBreadcrumb } from "@/components/ProjectBreadcrumb";
import { ClaquetaFab } from "@/components/ClaquetaFab";
import { ProjectPresence } from "@/components/ProjectPresence";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForProfile, listProjectsForProfile } from "@/lib/project-access";
import { getProjectFacts, getToolMode } from "@/lib/tool-access";
import { computeAccess } from "@/lib/tool-rules";

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
  const [project, projects] = profile
    ? await Promise.all([getProjectForProfile(profile, projectId), listProjectsForProfile(profile)])
    : [null, []];
  // Qué herramientas se enseñan: las que ya sirven en este proyecto (o todas en modo completo).
  const [facts, mode] =
    profile && project ? await Promise.all([getProjectFacts(projectId), getToolMode(profile.organizationId)]) : [null, "full" as const];
  const access = facts ? computeAccess(facts) : {};

  return (
    <div>
      {project && (
        <ProjectBreadcrumb
          projectId={projectId}
          projectName={project.name}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}
      <div className="mt-3">
        <ProjectSubNav projectId={projectId} access={access} mode={mode} />
      </div>
      <div className="mt-8">
        {profile && (
          <ProjectPresence
            projectId={projectId}
            userId={profile.id}
            userLabel={profile.fullName ?? profile.email}
          />
        )}
        {children}
      </div>
      {(mode === "full" || access.claqueta?.unlocked !== false) && <ClaquetaFab projectId={projectId} />}
    </div>
  );
}
