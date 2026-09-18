"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { TrashIcon } from "@/components/ToolIcons";
import { Modal } from "@/components/Modal";

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-danger">
      {pending && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {pending ? "Eliminando…" : "Sí, eliminar"}
    </button>
  );
}

// Borrar un proyecto entero es mucho más grave que borrar un elemento
// suelto (DeleteButton), así que aquí sí usamos un diálogo modal centrado
// en vez de la confirmación en línea de dos clics.
export function DeleteProjectButton({
  projectName,
  action,
}: {
  projectName: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Eliminar proyecto ${projectName}`}
        className="rounded p-2 text-muted transition hover:text-danger focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100"
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title={`¿Eliminar «${projectName}»?`}
        description="Se borrará todo el proyecto: guion, escenas, presupuesto, plan de rodaje, desglose y documentos. Esta acción no se puede deshacer."
      >
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={() => setOpen(false)} className="link-action">
            Cancelar
          </button>
          <form action={action}>
            <ConfirmSubmit />
          </form>
        </div>
      </Modal>
    </>
  );
}
