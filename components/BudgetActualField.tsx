"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { setBudgetItemActual, type BudgetActualState } from "@/lib/actions/budget";
import { useToast } from "@/components/Toast";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="link-action whitespace-nowrap !text-accent">
      {pending ? "…" : "Guardar"}
    </button>
  );
}

// Gasto real de una partida: un importe editable en la propia fila. Vacío =
// todavía sin gastar. "= previsto" lo rellena con el importe previsto (lo
// habitual cuando se paga lo presupuestado).
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
    <form ref={formRef} action={formAction} className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`actual-${itemId}`}>
        Gasto real de {description}
      </label>
      <div
        className={`flex items-center border transition-colors focus-within:border-accent ${
          isDone ? "border-success/40" : "border-line"
        }`}
      >
        <input
          ref={inputRef}
          id={`actual-${itemId}`}
          name="actualAmount"
          inputMode="decimal"
          defaultValue={actual ?? ""}
          placeholder="Gastado"
          className="w-24 bg-transparent px-2 py-1.5 text-right font-mono text-xs tabular-nums outline-none placeholder:text-muted/60"
        />
        <span aria-hidden className="pr-2 font-mono text-xs text-muted">
          €
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          if (inputRef.current) inputRef.current.value = planned.toFixed(2);
          formRef.current?.requestSubmit();
        }}
        className="link-action hidden whitespace-nowrap sm:inline-flex"
        title="Poner el gasto igual al importe previsto"
      >
        = previsto
      </button>
      <SaveButton />
    </form>
  );
}
