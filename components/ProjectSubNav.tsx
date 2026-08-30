"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

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
    ],
  },
  {
    label: "Organización",
    tools: [
      { label: "Tareas", href: "tareas" },
      { label: "Documentos", href: "documentos" },
    ],
  },
];

// Cierra el <details> que contiene el enlace en el que se acaba de hacer
// clic — sin esto, el desplegable se queda abierto tapando la página tras
// navegar, porque el layout del proyecto no se desmonta entre páginas.
function closeOnClick(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

export function ProjectSubNav({ projectId }: { projectId: string }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-line pb-4 print:hidden">
      <Link
        href={`/app/${projectId}`}
        className="border border-line px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted uppercase transition hover:border-accent hover:text-accent active:scale-[0.97]"
      >
        Resumen
      </Link>
      {CATEGORIES.map((category) => (
        <details key={category.label} className="group relative">
          <summary className="cursor-pointer list-none border border-line px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted uppercase transition [&::-webkit-details-marker]:hidden hover:border-accent hover:text-accent group-open:border-accent group-open:text-accent active:scale-[0.97]">
            {category.label} ▾
          </summary>
          <div className="absolute left-0 z-20 mt-2 w-48 border border-line bg-bg py-1 shadow-lg">
            {category.tools.map((tool) => (
              <Link
                key={tool.href}
                href={
                  "absolute" in tool && tool.absolute
                    ? tool.href
                    : `/app/${projectId}/${tool.href}`
                }
                onClick={closeOnClick}
                className="block px-3 py-2 font-mono text-xs text-muted transition hover:bg-bg-raised hover:text-accent active:bg-bg-raised"
              >
                {tool.label}
              </Link>
            ))}
          </div>
        </details>
      ))}
    </nav>
  );
}
