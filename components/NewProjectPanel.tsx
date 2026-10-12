"use client";

import { useState } from "react";
import Link from "next/link";
import { createProject } from "@/lib/actions/projects";
import { CreateProjectForm } from "@/components/CreateProjectForm";

// El formulario ya no flota en una cajita diminuta anclada a la esquina —
// se despliega a todo el ancho, debajo de la cabecera, con el mismo peso
// visual que el resto de formularios de la app.
export function NewProjectPanel({ hasProjects }: { hasProjects: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.0625rem] font-bold">Tus proyectos</h2>
        <div className="flex items-center gap-3">
          {hasProjects && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="btn btn-outline btn-sm"
            >
              <span
                className={`inline-block text-sm leading-none transition-transform ${open ? "rotate-45" : ""}`}
              >
                +
              </span>
              Nuevo proyecto
            </button>
          )}
          <Link href="/app/proyectos" className="link-action">
            Ver todos →
          </Link>
        </div>
      </div>
      {open && hasProjects && (
        <div className="mt-4 border rounded-lg border-line p-4 sm:p-5">
          <CreateProjectForm
            action={createProject}
            formClassName="flex flex-col gap-3 sm:flex-row sm:items-center"
            inputClassName="w-full border rounded-lg border-line bg-transparent px-3 py-2.5 text-sm outline-none transition-colors focus:border-accent"
            buttonClassName="btn btn-primary shrink-0"
            autoFocus
          />
        </div>
      )}
    </>
  );
}
