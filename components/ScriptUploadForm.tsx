"use client";

import { useActionState, useRef, useState } from "react";
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
// un segundo clic en "Subir". Si ya existe un guion, en vez de enviar
// directamente se muestra un aviso: subir uno nuevo reemplaza al actual.
export function ScriptUploadForm({
  action,
  existingFileName,
}: {
  action: (
    prevState: UploadScriptState,
    formData: FormData,
  ) => Promise<UploadScriptState>;
  existingFileName?: string | null;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-center gap-3"
      >
        <label className="cursor-pointer rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition hover:opacity-90 active:scale-[0.97]">
          {existingFileName ? "Reemplazar guion" : "Subir guion"}
          <input
            type="file"
            name="file"
            accept=".pdf,.doc,.docx"
            required
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (existingFileName) {
                setPendingFileName(file.name);
              } else {
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

      {pendingFileName && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPendingFileName(null)}
        >
          <div
            className="w-full max-w-sm border border-accent bg-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-display text-lg font-bold uppercase">
              ¿Reemplazar el guion?
            </p>
            <p className="mt-2 font-sans text-sm text-muted">
              Ya hay un guion subido ({existingFileName}). Si subes «
              {pendingFileName}», lo sustituirá — no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setPendingFileName(null)}
                className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingFileName(null);
                  formRef.current?.requestSubmit();
                }}
                className="rounded-full bg-accent px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
              >
                Sí, reemplazar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
