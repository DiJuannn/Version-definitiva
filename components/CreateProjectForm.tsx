"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { CreateProjectState } from "@/lib/actions/projects";

export function CreateProjectForm({
  action,
  formClassName,
  inputClassName,
  buttonClassName,
  buttonLabel = "Crear",
  autoFocus,
}: {
  action: (prevState: CreateProjectState, formData: FormData) => Promise<CreateProjectState>;
  formClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  autoFocus?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <div>
      <form action={formAction} className={formClassName}>
        <input
          name="name"
          placeholder="Nombre del proyecto"
          required
          autoFocus={autoFocus}
          className={inputClassName}
        />
        <SubmitButton pendingLabel="Creando…" className={buttonClassName}>
          {buttonLabel}
        </SubmitButton>
      </form>
      {state?.error && (
        <p className="mt-2 font-mono text-xs text-accent">{state.error}</p>
      )}
    </div>
  );
}
