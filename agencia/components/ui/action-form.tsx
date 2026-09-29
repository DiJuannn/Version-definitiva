"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import type { ActionState } from "@/lib/http/action";
import { buttonClass } from "./button";
import { cx } from "./cx";

type Ctx = { state: ActionState; pending: boolean };
const StateCtx = createContext<Ctx>({ state: null, pending: false });

/**
 * Envía el formulario con onSubmit + transición en lugar de `action={…}`:
 * así React no vacía los campos cuando la acción devuelve un error (el
 * comportamiento por defecto de React 19 resetea el formulario siempre).
 */
export function useKeepValuesAction(action: (prev: ActionState, fd: FormData) => Promise<ActionState>) {
  const [state, formAction, pending] = useActionState(action, null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter && submitter.getAttribute("name") ? submitter : undefined);
    startTransition(() => formAction(fd));
  };
  return { state, pending, onSubmit };
}

/** Error de un campo concreto devuelto por la Server Action. */
export function FieldError({ name }: { name: string }) {
  const { state } = useContext(StateCtx);
  const msg = state?.fieldErrors?.[name];
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
  const { state, pending, onSubmit } = useKeepValuesAction(action);
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
    <StateCtx.Provider value={{ state, pending }}>
      <form ref={ref} onSubmit={onSubmit} className={className} noValidate aria-busy={pending}>
        {children}
        {state && (state.ok ? showMessage && state.message : state.error) && (
          <p role={state.ok ? "status" : "alert"} className={cx("mt-3 text-[13px]", state.ok ? "text-[var(--tone-success)]" : "text-[var(--tone-danger)]")}>
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
  const { pending } = useContext(StateCtx);
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </button>
  );
}
