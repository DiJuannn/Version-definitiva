"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AnalyzeShotListState } from "@/lib/actions/shot-list-import";

function UploadStatus() {
  const { pending } = useFormStatus();
  return pending ? (
    <span className="inline-flex items-center gap-2 font-sans text-xs text-muted" role="status">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      Leyendo el documento… puede tardar un minuto.
    </span>
  ) : null;
}

// Un único botón hace de selector de archivo y de envío: al elegir el
// archivo se sube y se analiza en el mismo paso, y al terminar lleva
// directo a la pantalla de revisión de los planos propuestos.
export function ShotListUploadForm({
  action,
}: {
  action: (
    prevState: AnalyzeShotListState,
    formData: FormData,
  ) => Promise<AnalyzeShotListState>;
}) {
  const [state, formAction] = useActionState(action, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <label className="btn btn-secondary cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
        Importar guion técnico
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx"
          required
          className="sr-only"
          onChange={(e) => {
            const form = e.target.form;
            if (e.target.files?.[0] && form) form.requestSubmit();
          }}
        />
      </label>
      <UploadStatus />
      {state?.error && (
        <p className="w-full border-l-2 border-danger pl-3 font-sans text-xs text-danger">{state.error}</p>
      )}
    </form>
  );
}
