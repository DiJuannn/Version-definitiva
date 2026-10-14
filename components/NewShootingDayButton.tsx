"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";

// Botón «Nuevo día» del plan de rodaje: el formulario (solo la fecha) se abre
// en un diálogo en vez de estar siempre a la vista encima del tablero.
export function NewShootingDayButton({
  action,
  variant = "primary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn ${variant === "primary" ? "btn-primary" : "btn-outline"}`}
      >
        + Nuevo día
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo día de rodaje"
        description="Elige la fecha y te llevo a la ficha del día para marcar qué escenas y planos se ruedan."
      >
        {/* La acción redirige a la ficha del día nuevo: no hace falta cerrar a mano. */}
        <form action={action} className="mt-5 space-y-5">
          <FormField label="Fecha">
            <input type="date" name="date" required className="field w-full" />
          </FormField>
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="link-action"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Creando…" className="btn btn-primary">
              Crear día
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
