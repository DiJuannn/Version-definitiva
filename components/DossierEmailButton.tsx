"use client";

import { useActionState, useState } from "react";
import { sendDossierByEmail, type SendDossierState } from "@/lib/actions/dossier-email";
import { SubmitButton } from "@/components/SubmitButton";

export function DossierEmailButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<SendDossierState, FormData>(
    sendDossierByEmail.bind(null, projectId),
    undefined,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-outline inline-flex items-center gap-1.5 print:hidden"
      >
        Enviar por email
      </button>
    );
  }

  return (
    <div className="print:hidden">
      <form action={formAction} className="flex items-center gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="email@destino.com"
          className="w-48 border border-line bg-transparent px-3 py-2 text-xs outline-none focus:border-accent"
        />
        <SubmitButton
          pendingLabel="Enviando…"
          className="btn btn-secondary btn-sm"
        >
          Enviar
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-xs text-muted hover:text-accent"
        >
          Cancelar
        </button>
      </form>
      {state && "error" in state && (
        <p className="mt-1 font-mono text-xs text-danger">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="mt-1 font-mono text-xs text-success">✓ Enviado.</p>
      )}
    </div>
  );
}
