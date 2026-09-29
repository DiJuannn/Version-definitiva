"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/http/action";
import { buttonClass } from "./button";
import { cx } from "./cx";

const StateCtx = createContext<ActionState>(null);

/** Error de un campo concreto devuelto por la Server Action. */
export function FieldError({ name }: { name: string }) {
  const s = useContext(StateCtx);
  const msg = s?.fieldErrors?.[name];
  return msg ? (
    <p className="text-[13px] text-[var(--tone-danger)]" role="alert">
      {msg}
    </p>
  ) : null;
}

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
  showMessage = true,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (s: ActionState) => void;
  showMessage?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const cb = useRef(onSuccess);
  useEffect(() => {
    cb.current = onSuccess;
  });
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      cb.current?.(state);
    }
  }, [state, resetOnSuccess]);
  return (
    <StateCtx.Provider value={state}>
      <form ref={ref} action={formAction} className={className} noValidate>
        {children}
        {state && (state.ok ? showMessage && state.message : state.error) && (
          <p
            role={state.ok ? "status" : "alert"}
            className={cx("mt-3 text-[13px]", state.ok ? "text-[var(--tone-success)]" : "text-[var(--tone-danger)]")}
          >
            {state.ok ? state.message : state.error}
          </p>
        )}
      </form>
    </StateCtx.Provider>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "marker";
  size?: "sm" | "md";
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </button>
  );
}
