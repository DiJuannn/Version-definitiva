"use client";

import { useState } from "react";
import { createProject } from "@/lib/actions/projects";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { Modal } from "@/components/Modal";

// «Nuevo proyecto»: un botón que abre el formulario en un diálogo (papel), en vez de un
// formulario siempre abierto o desplegado a todo el ancho encima de la lista.
export function NewProjectPanel({ className = "btn btn-primary" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={className}>
        <span aria-hidden className="text-sm leading-none">+</span>
        Nuevo proyecto
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo proyecto"
        description="Ponle un nombre; el tipo, las fechas y el resto los rellenas luego en su ficha."
      >
        <div className="mt-5">
          <CreateProjectForm
            action={createProject}
            formClassName="flex flex-col gap-3"
            inputClassName="field w-full px-3 py-2.5 text-sm"
            buttonClassName="btn btn-primary self-start"
            buttonLabel="Crear proyecto"
            autoFocus
          />
        </div>
        <button type="button" onClick={() => setOpen(false)} className="link-action mt-3 !px-0">
          Cancelar
        </button>
      </Modal>
    </>
  );
}
