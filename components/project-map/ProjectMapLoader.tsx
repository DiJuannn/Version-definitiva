"use client";

import dynamic from "next/dynamic";

// El editor del mapa (y React Flow con él) se descarga solo al abrir esta vista.
const ProjectMapEditor = dynamic(() => import("@/components/project-map/ProjectMapEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-16rem)] min-h-[520px] items-center justify-center border border-line font-mono text-xs text-muted">
      Cargando el mapa…
    </div>
  ),
});

export function ProjectMapLoader(props: React.ComponentProps<typeof ProjectMapEditor>) {
  return <ProjectMapEditor {...props} />;
}
