"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";

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
    <button type="submit" disabled={pending} className="btn btn-danger">
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? "link-action"}
      >
        {trigger}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        title={title}
        description={description}
      >
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={() => setOpen(false)} className="link-action">
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
      </Modal>
    </>
  );
}
