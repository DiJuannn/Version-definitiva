"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { SceneSyncResult } from "@/lib/screenplay-scenes";

// «Pasar a producción»: trae del guion las escenas nuevas y los cambios, y
// dice qué ha hecho (o por qué no ha podido).
export function SyncScenesButton({
  action,
  label = "Pasar a producción",
  className = "btn btn-primary",
}: {
  action: () => Promise<SceneSyncResult>;
  label?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<SceneSyncResult | undefined>(() => action(), undefined);
  const parts =
    state?.ok === true
      ? [
          state.added ? `${state.added} ${state.added === 1 ? "escena nueva" : "escenas nuevas"}` : null,
          state.updated ? `${state.updated} ${state.updated === 1 ? "actualizada" : "actualizadas"}` : null,
        ].filter(Boolean)
      : [];
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <SubmitButton pendingLabel="Pasando escenas…" className={className}>
        {label}
      </SubmitButton>
      <p role="status" className="font-sans text-sm">
        {state?.ok === true && (
          <span className="text-success">✓ {parts.length ? parts.join(" y ") : "Ya estaba todo al día"}.</span>
        )}
        {state?.ok === false && <span className="text-danger">{state.error}</span>}
      </p>
    </form>
  );
}
