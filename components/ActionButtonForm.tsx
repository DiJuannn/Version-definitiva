"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

export type ActionState = { error: string } | undefined;

// Envuelve una Server Action que puede fallar (típicamente una llamada a
// IA) para que el error se muestre en la propia pantalla en vez de que la
// acción simplemente "no haga nada" — Taller nunca debe caerse ni quedarse
// en silencio si Mistral falla.
export function ActionButtonForm({
  action,
  pendingLabel,
  className,
  children,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  pendingLabel: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction}>
      <SubmitButton pendingLabel={pendingLabel} className={className}>
        {children}
      </SubmitButton>
      {state?.error && (
        <p className="mt-2 font-mono text-xs text-accent">{state.error}</p>
      )}
    </form>
  );
}
