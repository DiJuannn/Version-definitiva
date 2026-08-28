"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthField } from "@/components/AuthField";
import { signUp } from "@/lib/actions/auth";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, undefined);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">Crear cuenta</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Crea tu cuenta y la productora a la que pertenece.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <AuthField
          label="Nombre de la productora"
          name="organizationName"
          required
        />
        <AuthField label="Tu nombre" name="fullName" autoComplete="name" />
        <AuthField label="Email" name="email" type="email" required autoComplete="email" />
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

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-fg py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear cuenta"}
        </button>
      </form>

      <div className="mt-6 text-center font-mono text-xs text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-fg hover:text-accent">
          Entrar
        </Link>
      </div>
    </div>
  );
}
