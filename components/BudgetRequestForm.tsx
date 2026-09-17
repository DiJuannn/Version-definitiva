"use client";

import { useActionState } from "react";
import { submitBudgetRequest } from "@/lib/actions/budget-request";
import { SubmitButton } from "@/components/SubmitButton";

const PROJECT_TYPES = ["Ficción", "Publicidad", "Documental", "Corporativo", "Otro"];
const BUDGET_RANGES = [
  "Menos de 3.000€",
  "3.000€ – 10.000€",
  "10.000€ – 30.000€",
  "Más de 30.000€",
  "Aún no lo sé",
];

const fieldClass =
  "border border-line bg-transparent px-3 py-2.5 font-mono text-sm outline-none transition-colors focus:border-accent";

export function BudgetRequestForm() {
  const [state, formAction] = useActionState(submitBudgetRequest, undefined);

  if (state && "ok" in state) {
    return (
      <div className="border border-line p-8 text-center">
        <p className="font-display text-xl font-bold uppercase">
          Recibido.
        </p>
        <p className="mt-2 font-mono text-sm text-muted">
          Te contactamos en 24-48h con un presupuesto ajustado a tu proyecto.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {/* Honeypot anti-spam: oculto para personas, visible para bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px]"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <input
          name="name"
          placeholder="Tu nombre"
          required
          className={fieldClass}
        />
        <input
          type="email"
          name="email"
          placeholder="Tu email"
          required
          className={fieldClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <select name="projectType" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Tipo de proyecto
          </option>
          {PROJECT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select name="budgetRange" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Presupuesto orientativo
          </option>
          {BUDGET_RANGES.map((range) => (
            <option key={range} value={range}>
              {range}
            </option>
          ))}
        </select>
      </div>

      <textarea
        name="message"
        placeholder="Cuéntanos un poco tu idea (opcional)"
        rows={4}
        className={fieldClass}
      />

      {state?.error && (
        <p className="font-mono text-xs text-accent">{state.error}</p>
      )}

      <SubmitButton
        pendingLabel="Enviando…"
        className="w-fit rounded-full bg-fg px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        Enviar
      </SubmitButton>
    </form>
  );
}
