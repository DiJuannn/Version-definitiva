"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { setBudgetItemActual, type BudgetActualState } from "@/lib/actions/budget";
import { useToast } from "@/components/Toast";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="link-action whitespace-nowrap !text-accent transition-opacity hover:!text-fg focus-visible:opacity-100 lg:opacity-0 lg:group-hover/actual:opacity-100 lg:group-focus-within/actual:opacity-100">
      {pending ? "…" : "Guardar"}
    </button>
  );
}

// Gasto real de una partida: un importe editable en la propia fila. Vacío =
// todavía sin gastar. "= previsto" lo rellena con el importe previsto (lo
// habitual cuando se paga lo presupuestado). En pantalla ancha los botones
// solo aparecen al pasar por encima o al escribir, para no repetir el mismo
// «Guardar» en cada fila (Intro también guarda).
export function BudgetActualField({
  projectId,
  itemId,
  description,
  planned,
  actual,
}: {
  projectId: string;
  itemId: string;
  description: string;
  planned: number;
  actual: number | null;
}) {
  const [state, formAction] = useActionState<BudgetActualState, FormData>(
    setBudgetItemActual.bind(null, projectId, itemId),
    undefined,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state) return;
    if ("error" in state) toast("error", state.error);
    else toast("success", state.amount === null ? "Gasto quitado" : "Gasto guardado");
  }, [state, toast]);

  const isDone = actual !== null;

  return (
    <form ref={formRef} action={formAction} className="group/actual flex items-center gap-2">
      <label className="sr-only" htmlFor={`actual-${itemId}`}>
        Gasto real de {description}
      </label>
      {/* Sin caja: el importe se escribe sobre una raya, verde cuando ya está pagado. */}
      <div
        className={`flex items-baseline border-b transition-colors focus-within:border-accent ${
          isDone ? "border-success" : "border-line hover:border-muted"
        }`}
      >
        <input
          ref={inputRef}
          id={`actual-${itemId}`}
          name="actualAmount"
          inputMode="decimal"
          defaultValue={actual ?? ""}
          placeholder="Sin gastar"
          className={`w-24 bg-transparent py-1 text-right font-mono text-sm tabular-nums outline-none placeholder:font-sans placeholder:text-xs placeholder:text-muted/70 ${
            isDone ? "text-success" : ""
          }`}
        />
        <span aria-hidden className="pl-1 font-mono text-xs text-muted">
          €
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (inputRef.current) inputRef.current.value = planned.toFixed(2);
          formRef.current?.requestSubmit();
        }}
        className="link-action hidden whitespace-nowrap transition-opacity focus-visible:opacity-100 sm:inline-flex lg:opacity-0 lg:group-hover/actual:opacity-100 lg:group-focus-within/actual:opacity-100"
        title="Poner el gasto igual al importe previsto"
      >
        = previsto
      </button>
      <SaveButton />
    </form>
  );
}
