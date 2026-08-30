"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { UploadScriptState } from "@/lib/actions/script";

function UploadStatus() {
  const { pending } = useFormStatus();
  return pending ? (
    <span className="font-mono text-xs text-muted">Subiendo…</span>
  ) : null;
}

// Un único botón visible hace de selector de archivo Y de envío: al
// pulsarlo se abre el explorador de archivos (vía <label> nativo asociado
// al input oculto) y, en cuanto se elige un archivo, se envía solo — sin
// un segundo clic en "Subir".
export function ScriptUploadForm({
  action,
}: {
  action: (
    prevState: UploadScriptState,
    formData: FormData,
  ) => Promise<UploadScriptState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-center gap-3"
    >
      <label className="cursor-pointer rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition hover:opacity-90 active:scale-[0.97]">
        Subir guion
        <input
          type="file"
          name="file"
          accept=".pdf,.doc,.docx"
          required
          className="sr-only"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              formRef.current?.requestSubmit();
            }
          }}
        />
      </label>
      <UploadStatus />
      {state?.error && (
        <p className="w-full font-mono text-xs text-accent">{state.error}</p>
      )}
    </form>
  );
}
