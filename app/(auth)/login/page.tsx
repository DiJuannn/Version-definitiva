"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthField } from "@/components/AuthField";
import { logIn } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(logIn, undefined);
  const searchParams = useSearchParams();
  const justSignedUp = searchParams.get("confirm") === "1";

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">Entrar</h1>

      {justSignedUp && (
        <p className="mt-4 border border-line px-3 py-2 font-mono text-xs text-muted">
          Cuenta creada. Revisa tu email para confirmarla antes de entrar.
        </p>
      )}

      <form action={formAction} className="mt-8 space-y-4">
        <AuthField label="Email" name="email" type="email" required autoComplete="email" />
        <AuthField
          label="Contraseña"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />

        {state?.error && (
          <p className="font-mono text-xs text-accent">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-fg py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between font-mono text-xs text-muted">
        <Link href="/forgot-password" className="hover:text-accent">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/signup" className="text-fg hover:text-accent">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
