"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthField } from "@/components/AuthField";
import { acceptInvite } from "@/lib/actions/auth";

export function AcceptInviteForm({
  token,
  email,
  organizationName,
}: {
  token: string;
  email: string;
  organizationName: string;
}) {
  const action = acceptInvite.bind(null, token);
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">
        Únete a {organizationName}
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Te han invitado a colaborar en el Taller. Crea tu contraseña para
        entrar.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <div>
          <label className="block font-mono text-xs tracking-widest text-muted uppercase">
            Email
          </label>
          <input
            value={email}
            disabled
            className="mt-2 w-full border border-line bg-transparent px-3 py-2.5 text-sm text-muted outline-none"
          />
        </div>
        <AuthField label="Tu nombre" name="fullName" autoComplete="name" />
        <AuthField
          label="Contraseña"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />

        {state?.error && (
          <p className="font-mono text-xs text-accent">{state.error}</p>
        )}

        <label className="flex items-start gap-2 font-mono text-xs text-muted">
          <input type="checkbox" name="acceptTerms" required className="mt-0.5" />
          <span>
            Acepto los{" "}
            <Link
              href="/legal/terminos"
              target="_blank"
              className="text-fg underline hover:text-accent"
            >
              Términos de uso
            </Link>{" "}
            y la{" "}
            <Link
              href="/legal/privacidad"
              target="_blank"
              className="text-fg underline hover:text-accent"
            >
              Política de privacidad
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-fg py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Unirme"}
        </button>
      </form>

      <div className="mt-6 text-center font-mono text-xs text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/app/login" className="text-fg hover:text-accent">
          Entrar
        </Link>
      </div>
    </div>
  );
}
