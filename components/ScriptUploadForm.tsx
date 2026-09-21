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
  prominent = false,
}: {
  action: (
    prevState: UploadScriptState,
    formData: FormData,
  ) => Promise<UploadScriptState>;
  existingFileName?: string | null;
  // Botón principal (primer guion del proyecto) en vez del discreto de «Reemplazar».
  prominent?: boolean;
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
        <label className={`btn cursor-pointer ${prominent ? "btn-primary" : "btn-secondary btn-sm"}`}>
          {existingFileName ? "Reemplazar guion" : prominent ? "Elegir mi guion (PDF o Word)" : "Subir guion"}
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
          <p className="w-full font-mono text-xs text-danger">{state.error}</p>
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
            <p className="font-display text-lg font-bold">
              ¿Reemplazar el guion?
            </p>
            <p className="mt-2 font-sans text-sm text-muted">
              Ya hay un guion subido ({existingFileName}). Si subes «
              {pendingFileName}», lo sustituirá.
            </p>
            <p className="mt-3 border border-warn/60 p-3 font-sans text-sm text-warn">
              ⚠ Al analizarlo, podrás reemplazar todo lo del guion anterior (escenas, planos, personajes y desglose):
              se borrará y se sustituirá con el nuevo. Actores, equipo, presupuesto, días de rodaje, tareas y
              documentos no se tocan. Antes de borrar nada te pediremos confirmación.
            </p>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setPendingFileName(null)}
                className="link-action"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingFileName(null);
                  formRef.current?.requestSubmit();
                }}
                className="btn btn-primary"
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
