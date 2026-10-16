"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ProjectSearch } from "@/components/ProjectSearch";
import { PHASES, phaseOfSegment, toolOfSegment, type PhaseId } from "@/lib/project-phases";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";

const TOP =
  "relative flex h-14 shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[11px] tracking-widest uppercase transition-colors";
const UNDERLINE = "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-accent";
// A sangre: de borde a borde de la ventana aunque la página sea estrecha.
const BLEED = "mx-[calc(50%-50vw)] px-4 sm:px-6";

// La cabecera del proyecto en dos alturas (y nada más encima): arriba el
// logo, el Menú con las secciones de la organización, el proyecto, sus cuatro
// fases y la cuenta; debajo, siempre a la vista y fija al bajar, las
// herramientas de la fase elegida. La fase del proyecto lleva «ahora».
export function ProjectPhaseNav({
  projectId,
  stage,
  access,
  mode,
  lead,
  trailing,
  start,
  end,
}: {
  projectId: string;
  stage: PhaseId;
  access: Record<string, ToolAccess>;
  mode: ToolMode;
  // Antes de las fases (el nombre del proyecto) y al final (quién está dentro).
  lead?: ReactNode;
  trailing?: ReactNode;
  // Lo de la organización: logo y Menú al principio, la cuenta al final.
  start?: ReactNode;
  end?: ReactNode;
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
  // En móvil la fila se desplaza: que la fase elegida quede a la vista.
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = selectedRef.current;
    const row = el?.closest("[data-phase-row]");
    if (el && row && row.scrollWidth > row.clientWidth) row.scrollLeft = el.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft - 16;
  }, [shown]);
  const onCover = !segment;

  const side = (href: string, label: string) => {
    const on = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`relative px-3 py-3 font-sans text-[13.5px] whitespace-nowrap transition-colors ${
          on ? "font-semibold text-fg after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-accent" : "text-muted hover:text-fg"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <div data-project-bar className={`taller-ink -mt-8 border-b border-line bg-bg text-fg print:hidden sm:-mt-12 ${BLEED}`}>
        <div className="mx-auto flex max-w-6xl items-center gap-x-4 sm:gap-x-5">
          {start}
          <nav
            aria-label="Proyecto"
            data-phase-row
            className="flex min-w-0 flex-1 items-center gap-x-5 overflow-x-auto [scrollbar-width:none] sm:gap-x-6 [&::-webkit-scrollbar]:hidden"
          >
            {lead}
            {lead && <span aria-hidden className="h-4 w-px shrink-0 bg-line" />}
            <Link
              href={base}
              aria-current={onCover ? "page" : undefined}
              className={`${TOP} ${onCover ? `text-fg ${UNDERLINE}` : "text-muted hover:text-fg"}`}
            >
              Portada
            </Link>
            <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
            <div className="flex shrink-0 items-center gap-x-5 sm:gap-x-6" role="tablist" aria-label="Fases del proyecto">
              {PHASES.map((p) => {
                const selected = p.id === shown;
                const inRoute = p.id === routePhase;
                return (
                  <button
                    key={p.id}
                    ref={selected ? selectedRef : undefined}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setShown(p.id)}
                    className={`${TOP} ${selected ? "text-fg" : "text-muted hover:text-fg"} ${inRoute ? UNDERLINE : ""}`}
                  >
                    <span
                      className={`grid h-[18px] w-[18px] place-items-center rounded-full text-[10px] tracking-normal ${
                        p.id <= stage ? "text-[#111]" : "border border-line text-muted"
                      }`}
                      style={p.id <= stage ? { background: `var(--phase-${p.id})`, opacity: p.id < stage ? 0.75 : 1 } : undefined}
                    >
                      {p.id < stage ? "✓" : p.id}
                    </span>
                    {p.label}
                    {p.id === stage && (
                      <span
                        className="rounded-full px-1.5 py-px text-[10px] tracking-wider normal-case"
                        style={{ color: `var(--phase-${p.id})`, background: `color-mix(in srgb, var(--phase-${p.id}) 16%, transparent)` }}
                      >
                        ahora
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
          <div className="flex shrink-0 items-center gap-x-4 sm:gap-x-5">
            <ProjectSearch projectId={projectId} />
            {trailing}
            {end}
          </div>
        </div>
      </div>

      {/* Las herramientas de la fase: una fila, todas a la vista. */}
      <div
        role="tabpanel"
        aria-label={`Herramientas de ${phase.label}`}
        className={`taller-ink sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--bg)_94%,white)]/95 text-fg backdrop-blur-md print:hidden ${BLEED}`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-x-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {phase.tools.map((tool) => {
            const href = tool.absolute ? tool.href : `${base}/${tool.href}`;
            const on = activeTool === tool.href;
            const locked = mode === "simple" && !isUnlocked(access, tool.href) && !on;
            const inner = (
              <>
                <span className="h-4 w-4 shrink-0" style={on ? { color: `var(--phase-${phase.id})` } : undefined}>
                  {tool.icon}
                </span>
                {tool.label}
                {tool.pro && (
                  <span className="rounded-full bg-accent/15 px-1.5 py-px font-mono text-[10px] tracking-widest text-accent uppercase">
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
                className={`${cls} ${on ? "font-semibold text-fg after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-[var(--tool-line)]" : "text-muted hover:text-fg"}`}
                style={on ? ({ "--tool-line": `var(--phase-${phase.id})` } as React.CSSProperties) : undefined}
              >
                {inner}
              </Link>
            );
          })}
          <span className="ml-auto flex shrink-0 items-center gap-x-1 pl-4">
            {side(`${base}/resumen`, "Resumen")}
            {side(`${base}/tareas`, "Tareas")}
          </span>
        </div>
      </div>
    </>
  );
}
