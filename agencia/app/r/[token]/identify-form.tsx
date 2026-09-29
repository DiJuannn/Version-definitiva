"use client";

import { useKeepValuesAction } from "@/components/ui/action-form";
import { identifyAction } from "@/app/actions/share";
import { Field, Input } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export function IdentifyForm({ token, needsPassword, needsEmail, domain }: { token: string; needsPassword: boolean; needsEmail: boolean; domain: string | null }) {
  const { state, pending, onSubmit } = useKeepValuesAction(identifyAction);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field label="Tu nombre" htmlFor="g-name">
        <Input id="g-name" name="name" autoComplete="name" required autoFocus />
      </Field>
      <Field label="Email" htmlFor="g-email" optional={!needsEmail} hint={domain ? `Solo se admiten emails de ${domain}` : undefined}>
        <Input id="g-email" name="email" type="email" autoComplete="email" required={needsEmail} />
      </Field>
      {needsPassword && (
        <Field label="Contraseña del enlace" htmlFor="g-pw">
          <Input id="g-pw" name="password" type="password" required />
        </Field>
      )}
      {state?.error && <p role="alert" className="text-[13px] text-[var(--tone-danger)]">{state.error}</p>}
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "w-full")}>
        {pending ? "Entrando…" : "Entrar a la revisión"}
      </button>
    </form>
  );
}
