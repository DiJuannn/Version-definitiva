"use client";

import dynamic from "next/dynamic";

const ProjectMapViewer = dynamic(() => import("@/components/project-map/ProjectMapViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-9rem)] min-h-[420px] items-center justify-center border border-line font-mono text-xs text-muted">
      Cargando la pizarra…
    </div>
  ),
});

export function ProjectMapViewerLoader(props: React.ComponentProps<typeof ProjectMapViewer>) {
  return <ProjectMapViewer {...props} />;
}
