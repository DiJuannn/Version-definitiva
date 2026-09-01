import type { ReactNode } from "react";
import { ProjectSubNav } from "@/components/ProjectSubNav";
import { ClaquetaFab } from "@/components/ClaquetaFab";
import { ProjectPresence } from "@/components/ProjectPresence";
import { getCurrentProfile } from "@/lib/current-user";

// La autorización real (¿este proyecto es de tu organización o te lo
// compartieron?) la hace cada página con getProjectForCurrentUser — este
// layout solo pinta enlaces y presencia, no datos del proyecto, así que no
// necesita repetir esa consulta.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const profile = await getCurrentProfile();

  return (
    <div>
      <ProjectSubNav projectId={projectId} />
      <div className="mt-6">
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
