"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ProjectSearch } from "@/components/ProjectSearch";
import { PHASES, phaseOfSegment, toolOfSegment, type PhaseId } from "@/lib/project-phases";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";

const TOP =
  "relative flex min-h-10 items-center gap-2 pb-2.5 pt-1 font-mono text-[11px] tracking-widest uppercase transition-colors";
const UNDERLINE = "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent";

// Menú del proyecto en dos alturas, sin desplegables: arriba las cuatro fases
// (y la portada); debajo, siempre a la vista, las herramientas de la fase
// elegida. La fase en la que está el proyecto lleva la marca «ahora».
export function ProjectPhaseNav({
  projectId,
  stage,
  access,
  mode,
}: {
  projectId: string;
  stage: PhaseId;
  access: Record<string, ToolAccess>;
  mode: ToolMode;
}) {
  const pathname = usePathname();
  const base = `/app/${projectId}`;
  const segment = pathname.split("/")[3];
  const routePhase = phaseOfSegment(segment);
  const activeTool = toolOfSegment(segment);
  const [shown, setShown] = useState<PhaseId>(routePhase ?? stage);
  // Al navegar a otra fase, el menú la sigue (ajuste durante el render).
  const [prevRoutePhase, setPrevRoutePhase] = useState(routePhase);
  if (routePhase !== prevRoutePhase) {
    setPrevRoutePhase(routePhase);
    if (routePhase) setShown(routePhase);
  }
  const phase = PHASES.find((p) => p.id === shown) ?? PHASES[0];
  const onCover = !segment;

  const side = (href: string, label: string) => {
    const on = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`${TOP} ${on ? `text-fg ${UNDERLINE}` : "text-muted hover:text-fg"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav aria-label="Proyecto" className="print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-x-8">
        <div className="flex flex-wrap items-center gap-x-6" role="tablist" aria-label="Fases del proyecto">
          <Link
            href={base}
            aria-current={onCover ? "page" : undefined}
            className={`${TOP} ${onCover ? `text-fg ${UNDERLINE}` : "text-muted hover:text-fg"}`}
          >
            Portada
          </Link>
          <span aria-hidden className="h-4 w-px bg-line" />
          {PHASES.map((p) => {
            const selected = p.id === shown;
            const inRoute = p.id === routePhase;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setShown(p.id)}
                className={`${TOP} ${selected ? "text-fg" : "text-muted hover:text-fg"} ${inRoute ? UNDERLINE : ""}`}
              >
                <span
                  className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] tracking-normal ${
                    p.id < stage
                      ? "bg-accent/25 text-accent"
                      : p.id === stage
                        ? "bg-accent text-bg"
                        : "border border-line text-muted"
                  }`}
                >
                  {p.id < stage ? "✓" : p.id}
                </span>
                {p.label}
                {p.id === stage && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-px text-[9px] tracking-wider text-accent normal-case">
                    ahora
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-x-6">
          {side(`${base}/resumen`, "Resumen")}
          {side(`${base}/tareas`, "Tareas")}
          <ProjectSearch projectId={projectId} />
        </div>
      </div>

      {/* Las herramientas de la fase: una fila, todas a la vista. */}
      <div
        role="tabpanel"
        aria-label={`Herramientas de ${phase.label}`}
        className="mx-[calc(50%-50vw)] mt-1 border-t border-line bg-white/[0.025] px-[calc(50vw-50%)]"
      >
        <div className="-mx-1 flex items-center gap-x-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {phase.tools.map((tool) => {
            const href = tool.absolute ? tool.href : `${base}/${tool.href}`;
            const on = activeTool === tool.href;
            const locked = mode === "simple" && !isUnlocked(access, tool.href) && !on;
            const inner = (
              <>
                <span className={`h-4 w-4 shrink-0 ${on ? "text-accent" : ""}`}>{tool.icon}</span>
                {tool.label}
                {tool.pro && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-px font-mono text-[9px] tracking-widest text-accent uppercase">
                    Pro
                  </span>
                )}
              </>
            );
            const cls = `relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3 py-3 font-sans text-[14px] transition-colors`;
            return locked ? (
              <span
                key={tool.href}
                title={access[tool.href]?.reason}
                aria-disabled="true"
                className={`${cls} cursor-default text-muted/45`}
              >
                {inner}
              </span>
            ) : (
              <Link
                key={tool.href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`${cls} ${on ? `font-semibold text-fg ${UNDERLINE}` : "text-muted hover:text-fg"}`}
              >
                {inner}
              </Link>
            );
          })}
          <span className="ml-auto hidden shrink-0 pl-6 font-sans text-[13px] text-muted/70 lg:block">{phase.hint}</span>
        </div>
      </div>
    </nav>
  );
}
