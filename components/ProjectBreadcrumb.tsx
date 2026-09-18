"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { TOOL_GROUPS } from "@/lib/tool-groups";
import { useClickOutside } from "@/lib/use-click-outside";

type ProjectOption = { id: string; name: string };

const SEGMENT_LABELS: Record<string, string> = {
  resumen: "Resumen",
  ...Object.fromEntries(
    TOOL_GROUPS.flatMap((g) => g.tools)
      .filter((t) => !t.absolute)
      .map((t) => [t.href, t.label]),
  ),
};

// Migas del proyecto: Proyectos / [Nombre ▾] / Herramienta. El desplegable
// cambia de proyecto sin perder la herramienta en la que estás (Presupuesto
// de un proyecto → Presupuesto de otro).
export function ProjectBreadcrumb({
  projectId,
  projectName,
  projects,
}: {
  projectId: string;
  projectName: string;
  projects: ProjectOption[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const segment = pathname.split("/")[3] ?? "";
  const toolLabel = SEGMENT_LABELS[segment];
  const others = projects.filter((p) => p.id !== projectId);

  return (
    <nav aria-label="Ruta" className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-widest uppercase print:hidden">
      <Link href="/app/proyectos" className="text-muted hover:text-fg">
        Proyectos
      </Link>
      <span aria-hidden className="text-muted/50">
        /
      </span>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={others.length === 0}
          className="flex min-h-8 items-center gap-1.5 text-fg disabled:cursor-default"
        >
          <span className="max-w-[16rem] truncate normal-case tracking-normal">{projectName}</span>
          {others.length > 0 && (
            <span aria-hidden className="text-[9px] text-muted">
              ▾
            </span>
          )}
        </button>
        {open && others.length > 0 && (
          <div
            role="menu"
            className="absolute left-0 z-30 mt-1 max-h-72 w-64 overflow-y-auto border border-line bg-bg-raised py-1.5 shadow-2xl shadow-black/60"
          >
            <p className="px-3.5 pb-1.5 text-[10px] text-muted">Cambiar de proyecto</p>
            {others.map((project) => (
              <Link
                key={project.id}
                href={`/app/${project.id}${segment ? `/${segment}` : ""}`}
                role="menuitem"
                onClick={close}
                className="block truncate border-l-2 border-transparent px-3.5 py-2.5 normal-case tracking-normal text-muted transition hover:border-accent/60 hover:text-fg"
              >
                {project.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      {toolLabel && (
        <>
          <span aria-hidden className="text-muted/50">
            /
          </span>
          <span className="text-accent">{toolLabel}</span>
        </>
      )}
    </nav>
  );
}
