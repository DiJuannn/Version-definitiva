"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { TrashIcon } from "@/components/ToolIcons";

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-70"
    >
      {pending && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
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

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Eliminar proyecto ${projectName}`}
        className="rounded p-1.5 text-muted opacity-100 transition hover:text-accent sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
      >
        <TrashIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm border border-accent bg-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg font-bold uppercase">
              ¿Eliminar «{projectName}»?
            </p>
            <p className="mt-2 font-sans text-sm text-muted">
              Se borrará todo el proyecto: guion, escenas, presupuesto, plan
              de rodaje, desglose y documentos. Esta acción no se puede
              deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
              >
                Cancelar
              </button>
              <form action={action}>
                <ConfirmSubmit />
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
