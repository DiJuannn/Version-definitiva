"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error && (
        <p role="alert" className="text-[13px] text-[var(--tone-danger)]">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "mt-1 w-full")}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-[13px] text-ink-3">¿Olvidaste la contraseña? Pide a administración que la restablezca.</p>
    </form>
  );
}
