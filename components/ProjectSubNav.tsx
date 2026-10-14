"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";
import { ProjectSearch } from "@/components/ProjectSearch";
import { ToolModeToggle } from "@/components/ToolModeToggle";
import { TOOL_GROUPS } from "@/lib/tool-groups";
import { isUnlocked, type ToolAccess, type ToolMode } from "@/lib/tool-rules";

// Cierra el <details> que contiene el enlace en el que se acaba de hacer
// clic — sin esto, el desplegable se queda abierto tapando la página tras
// navegar, porque el layout del proyecto no se desmonta entre páginas.
function closeOnClick(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

// Pestañas de texto sobre una línea (como el menú principal), sin cajas: la
// activa lleva la raya de color debajo.
const CHIP =
  "relative flex min-h-10 items-center gap-1.5 px-0.5 pb-2.5 pt-1 font-mono text-[11px] tracking-widest uppercase transition-colors";
const CHIP_IDLE = "text-muted hover:text-fg";
const CHIP_ACTIVE = "text-fg after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent";

// Mismas herramientas y mismos grupos que el resto de la app (TOOL_GROUPS):
// una sola lista, con iconos. El chip de la fase actual dice también qué
// herramienta estás usando.
export function ProjectSubNav({
  projectId,
  access,
  mode,
}: {
  projectId: string;
  access: Record<string, ToolAccess>;
  mode: ToolMode;
}) {
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const base = `/app/${projectId}`;

  const toolHref = (tool: { href: string; absolute?: boolean }) =>
    tool.absolute ? tool.href : `${base}/${tool.href}`;
  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Sin esto, un desplegable abierto se queda tapando la página al hacer
  // clic fuera — el atributo `name` en cada <details> ya hace que abrir
  // uno cierre los otros dos, pero eso no cubre un clic fuera del todo.
  useEffect(() => {
    function closeAll() {
      navRef.current
        ?.querySelectorAll("details[open]")
        .forEach((details) => details.removeAttribute("open"));
    }
    function closeIfOutside(e: globalThis.MouseEvent) {
      if (!navRef.current || navRef.current.contains(e.target as Node)) return;
      closeAll();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    document.addEventListener("mousedown", closeIfOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", closeIfOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Herramientas del proyecto"
      className="flex flex-wrap items-center gap-x-6 print:hidden"
    >
      <Link
        href={base}
        aria-current={pathname === base ? "page" : undefined}
        className={`${CHIP} ${pathname === base ? CHIP_ACTIVE : CHIP_IDLE}`}
      >
        Proyecto
      </Link>
      <Link
        href={`${base}/resumen`}
        aria-current={isOn(`${base}/resumen`) ? "page" : undefined}
        className={`${CHIP} ${isOn(`${base}/resumen`) ? CHIP_ACTIVE : CHIP_IDLE}`}
      >
        Resumen
      </Link>
      {TOOL_GROUPS.map((group) => {
        const activeTool = group.tools.find((tool) => isOn(toolHref(tool)));
        // En modo simple solo salen las herramientas que ya sirven (y la que estás usando).
        const tools =
          mode === "full" ? group.tools : group.tools.filter((tool) => isUnlocked(access, tool.href) || tool === activeTool);
        if (tools.length === 0) return null;
        return (
          <details key={group.label} name="project-subnav" className="group relative">
            <summary
              className={`${CHIP} cursor-pointer list-none [&::-webkit-details-marker]:hidden group-open:text-accent ${
                activeTool ? CHIP_ACTIVE : CHIP_IDLE
              }`}
            >
              {group.label}
              {activeTool && (
                <span className="hidden normal-case tracking-normal text-fg sm:inline">
                  · {activeTool.label}
                </span>
              )}
              <span aria-hidden className="text-[9px] opacity-70">
                ▾
              </span>
            </summary>
            <div className="menu-panel absolute left-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)]">
              <p className="px-3 pt-1.5 pb-2 font-mono text-[10px] tracking-widest text-muted/70 uppercase">{group.label}</p>
              {tools.map((tool) => {
                const toolActive = isOn(toolHref(tool));
                return (
                  <Link
                    key={tool.label}
                    href={toolHref(tool)}
                    onClick={closeOnClick}
                    aria-current={toolActive ? "page" : undefined}
                    className="menu-item group/item items-start normal-case tracking-normal"
                  >
                    <span
                      className={`mt-0.5 h-4 w-4 shrink-0 ${toolActive ? "text-accent" : "text-muted group-hover/item:text-fg"}`}
                    >
                      {tool.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-sans text-[14px] font-semibold">
                        {tool.label}
                        {tool.pro && (
                          <span className="rounded-full bg-accent px-1.5 py-px font-mono text-[9px] tracking-widest text-bg uppercase">
                            Pro
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block font-sans text-[12px] text-muted">{tool.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
      <ProjectSearch projectId={projectId} />
      {mode === "simple" && <ToolModeToggle mode={mode} className={`${CHIP} ${CHIP_IDLE}`} label="Ver todas" />}
    </nav>
  );
}
