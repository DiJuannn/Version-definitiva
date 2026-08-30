import type { ReactNode } from "react";
import { ProjectSubNav } from "@/components/ProjectSubNav";

// La autorización real (¿este proyecto es de tu organización?) la hace cada
// página con getProjectForCurrentUser — este layout solo pinta enlaces, no
// datos, así que no necesita repetir esa consulta.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div>
      <ProjectSubNav projectId={projectId} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
