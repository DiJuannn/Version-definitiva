import type { ReactNode } from "react";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { ProjectBreadcrumb } from "@/components/ProjectBreadcrumb";
import { ClaquetaFab } from "@/components/ClaquetaFab";
import { ProjectPresence } from "@/components/ProjectPresence";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForProfile, listProjectsForProfile } from "@/lib/project-access";

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
        <ProjectSubNav projectId={projectId} />
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
      <ClaquetaFab projectId={projectId} />
    </div>
  );
}
