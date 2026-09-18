"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type MouseEvent } from "react";

// Solo herramientas que existen de verdad por proyecto — nada inventado.
// Guion/Desglose/etc. cuelgan de este proyecto; Calendario es un recurso de
// toda la organización (se gestiona en /app/calendario), por eso lleva
// `absolute: true` — su href no se prefija con el id del proyecto.
const CATEGORIES = [
  {
    label: "Preproducción",
    tools: [
      { label: "Guion", href: "guion" },
      { label: "Desglose", href: "desglose" },
      { label: "Personajes", href: "personajes" },
      { label: "Shot list", href: "shot-list" },
      { label: "Storyboard", href: "storyboard" },
      { label: "Calendario", href: "/app/calendario", absolute: true },
    ],
  },
  {
    label: "Producción",
    tools: [
      { label: "Plan de rodaje", href: "plan-de-rodaje" },
      { label: "Call sheets", href: "call-sheets" },
      { label: "Presupuesto", href: "presupuesto" },
      { label: "Claqueta", href: "claqueta" },
    ],
  },
  {
    label: "Organización",
    tools: [
      { label: "Tareas", href: "tareas" },
      { label: "Biblioteca de archivos", href: "documentos" },
      { label: "Plantilla de documentos", href: "documentos-legales" },
      { label: "Localizaciones", href: "localizaciones" },
      { label: "Vehículos", href: "vehiculos" },
    ],
  },
];

// Cierra el <details> que contiene el enlace en el que se acaba de hacer
// clic — sin esto, el desplegable se queda abierto tapando la página tras
// navegar, porque el layout del proyecto no se desmonta entre páginas.
function closeOnClick(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

const CHIP =
  "rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-widest uppercase transition active:scale-[0.97]";
const CHIP_IDLE = "border-line text-muted hover:border-accent/60 hover:text-fg";
const CHIP_ACTIVE = "border-accent/50 bg-accent/10 text-accent";

export function ProjectSubNav({ projectId }: { projectId: string }) {
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
    function closeIfOutside(e: globalThis.MouseEvent) {
      if (!navRef.current || navRef.current.contains(e.target as Node)) return;
      navRef.current
        .querySelectorAll("details[open]")
        .forEach((details) => details.removeAttribute("open"));
    }
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, []);

  return (
    <nav ref={navRef} className="flex flex-wrap items-center gap-2 print:hidden">
      <Link
        href={base}
        className={`${CHIP} ${pathname === base ? CHIP_ACTIVE : CHIP_IDLE}`}
      >
        Panel
      </Link>
      <Link
        href={`${base}/resumen`}
        className={`${CHIP} ${isOn(`${base}/resumen`) ? CHIP_ACTIVE : CHIP_IDLE}`}
      >
        Resumen
      </Link>
      {CATEGORIES.map((category) => {
        const active = category.tools.some((tool) => isOn(toolHref(tool)));
        return (
          <details key={category.label} name="project-subnav" className="group relative">
            <summary
              className={`${CHIP} cursor-pointer list-none [&::-webkit-details-marker]:hidden group-open:border-accent/50 group-open:text-accent ${
                active ? CHIP_ACTIVE : CHIP_IDLE
              }`}
            >
              {category.label} <span className="text-[9px] opacity-70">▾</span>
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-56 border border-line bg-bg-raised py-1.5 shadow-2xl shadow-black/60">
              {category.tools.map((tool) => {
                const toolActive = isOn(toolHref(tool));
                return (
                  <Link
                    key={tool.href}
                    href={toolHref(tool)}
                    onClick={closeOnClick}
                    className={`block border-l-2 px-3.5 py-2 font-mono text-xs transition ${
                      toolActive
                        ? "border-accent text-accent"
                        : "border-transparent text-muted hover:border-accent/60 hover:text-fg"
                    }`}
                  >
                    {tool.label}
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
