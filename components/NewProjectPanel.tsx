"use client";

import { useState } from "react";
import Link from "next/link";
import { createProject } from "@/lib/actions/projects";
import { SubmitButton } from "@/components/SubmitButton";

// El formulario ya no flota en una cajita diminuta anclada a la esquina —
// se despliega a todo el ancho, debajo de la cabecera, con el mismo peso
// visual que el resto de formularios de la app.
export function NewProjectPanel({ hasProjects }: { hasProjects: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
          Proyectos recientes
        </p>
        <div className="flex items-center gap-4">
          {hasProjects && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase transition hover:text-accent"
            >
              <span
                className={`inline-block text-sm leading-none transition-transform ${open ? "rotate-45" : ""}`}
              >
                +
              </span>
              Nuevo proyecto
            </button>
          )}
          <Link
            href="/app/proyectos"
            className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
          >
            Ver todos →
          </Link>
        </div>
      </div>
      {open && hasProjects && (
        <form
          action={createProject}
          className="mt-4 flex flex-col gap-3 border border-line p-4 sm:flex-row sm:items-center sm:p-5"
        >
          <input
            name="name"
            placeholder="Nombre del proyecto"
            required
            autoFocus
            className="w-full border border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
          />
          <SubmitButton
            pendingLabel="Creando…"
            className="shrink-0 rounded-full bg-accent px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-70"
          >
            Crear
          </SubmitButton>
        </form>
      )}
    </>
  );
}
