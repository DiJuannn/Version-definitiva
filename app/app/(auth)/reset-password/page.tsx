"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { AuthField } from "@/components/AuthField";
import { updatePassword } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, undefined);
  const [status, setStatus] = useState<"checking" | "ok" | "invalid">(
    "checking",
  );

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setStatus(session ? "ok" : "invalid");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStatus("ok");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (status === "checking") {
    return <p className="font-mono text-xs text-muted">Comprobando enlace…</p>;
  }

  if (status === "invalid") {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold uppercase">
          Enlace no válido
        </h1>
        <p className="mt-4 font-mono text-xs text-muted">
          Este enlace ha caducado o ya se usó.{" "}
          <Link href="/app/forgot-password" className="text-fg hover:text-accent">
            Pide uno nuevo
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold uppercase">
        Nueva contraseña
      </h1>

      <form action={formAction} className="mt-8 space-y-4">
        <AuthField
          label="Nueva contraseña"
          name="password"
          type="password"
          required
          autoComplete="new-password"
        />
        <AuthField
          label="Repite la contraseña"
          name="confirmPassword"
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
          {pending ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </div>
  );
}
