"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Cierra el modal cuando pending pasa de true a false (la acción ya
// terminó de verdad) — cerrarlo en el propio manejador de la acción, en
// el mismo tick en que arranca, desmonta el <form> a mitad de envío y
// la acción del servidor nunca llega a ejecutarse.
function ConfirmSubmit({
  confirmLabel,
  pendingLabel,
  onDone,
}: {
  confirmLabel: string;
  pendingLabel: string;
  onDone: () => void;
}) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-70"
    >
      {pending && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {pending ? pendingLabel : confirmLabel}
    </button>
  );
}

// Mismo diálogo modal que DeleteProjectButton, generalizado — para
// cualquier acción destructiva que afecte a varias cosas a la vez (no
// un solo elemento suelto, para eso ya está DeleteButton con su
// confirmación en línea de dos clics).
export function DangerConfirmButton({
  trigger,
  triggerClassName,
  title,
  description,
  confirmLabel = "Sí, eliminar",
  pendingLabel = "Eliminando…",
  action,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
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
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm border border-accent bg-bg p-6">
            <p className="font-display text-lg font-bold uppercase">{title}</p>
            <p className="mt-2 font-sans text-sm text-muted">{description}</p>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
              >
                Cancelar
              </button>
              <form action={action}>
                <ConfirmSubmit
                  confirmLabel={confirmLabel}
                  pendingLabel={pendingLabel}
                  onDone={() => setOpen(false)}
                />
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
