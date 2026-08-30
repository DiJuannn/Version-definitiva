"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthField } from "@/components/AuthField";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    undefined,
  );
  const searchParams = useSearchParams();
  const sent = searchParams.get("sent") === "1";

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold uppercase">
          Revisa tu email
        </h1>
        <p className="mt-4 font-mono text-xs text-muted">
          Si existe una cuenta con ese email, te hemos enviado un enlace para
          crear una nueva contraseña.
        </p>
        <div className="mt-6 text-center font-mono text-xs text-muted">
          <Link href="/app/login" className="text-fg hover:text-accent">
            Volver a entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">
        Recuperar contraseña
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Te enviamos un enlace para crear una nueva.
      </p>

      <form action={formAction} className="mt-8 space-y-4">
        <AuthField label="Email" name="email" type="email" required autoComplete="email" />

        {state?.error && (
          <p className="font-mono text-xs text-accent">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-fg py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "Enviar enlace"}
        </button>
      </form>

      <div className="mt-6 text-center font-mono text-xs text-muted">
        <Link href="/app/login" className="text-fg hover:text-accent">
          Volver a entrar
        </Link>
      </div>
    </div>
  );
}
