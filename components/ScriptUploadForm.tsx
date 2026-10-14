"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { UploadScriptState } from "@/lib/actions/script";
import { Modal } from "@/components/Modal";

function UploadStatus() {
  const { pending } = useFormStatus();
  return pending ? (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-muted" role="status">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      Subiendo…
    </span>
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
        <label className={`btn cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${prominent ? "btn-primary" : "btn-outline btn-sm"}`}>
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

      <Modal
        open={pendingFileName !== null}
        onClose={() => setPendingFileName(null)}
        title="¿Reemplazar el guion?"
        description={`Ya hay un guion subido (${existingFileName}). Si subes «${pendingFileName}», lo sustituirá.`}
      >
        <p className="mt-4 border-l-2 border-warn pl-3 font-sans text-sm leading-relaxed text-fg">
          Al analizarlo podrás reemplazar todo lo del guion anterior (escenas, planos, personajes y desglose).
          Actores, equipo, presupuesto, días de rodaje, tareas y documentos no se tocan, y antes de borrar nada te
          pediremos confirmación.
        </p>
        <div className="mt-6 flex justify-end gap-4">
          <button type="button" onClick={() => setPendingFileName(null)} className="link-action">
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
      </Modal>
    </>
  );
}
