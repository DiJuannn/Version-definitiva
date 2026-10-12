"use client";

import { useActionState, useState } from "react";
import { deleteOwnAccount } from "@/lib/actions/account";
import { FormError } from "@/components/FormError";

const CONFIRM_PHRASE = "ELIMINAR MI CUENTA";

// La acción más destructiva de toda la app — borra la cuenta y, si eres
// la única persona de tu organización, todo lo que hay dentro (ver
// lib/account-delete-core.ts). Por eso el botón de verdad solo se
// habilita al escribir la frase exacta, no con un simple "¿seguro?".
export function DeleteAccountCard({ soleMember }: { soleMember: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction, pending] = useActionState(deleteOwnAccount, undefined);

  const canSubmit = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  return (
    <section className="mt-10 border rounded-lg border-accent/40 p-6">
      <p className="text-[13px] text-accent">
        Zona de riesgo
      </p>

      {!open ? (
        <>
          <p className="mt-3 text-xs text-muted">
            Borrar tu cuenta es permanente y no se puede deshacer.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="link-action mt-4"
          >
            Eliminar mi cuenta
          </button>
        </>
      ) : (
        <div className="mt-3">
          <p className="font-sans text-sm text-muted">
            {soleMember ? (
              <>
                Eres la única persona de tu organización — al borrar tu cuenta se
                borran también <strong className="text-fg">todos sus proyectos y datos</strong> (escenas,
                presupuesto, documentos, localizaciones, flota, tareas...). No hay
                forma de deshacerlo.
              </>
            ) : (
              <>
                Se borra tu usuario y tu acceso. Los proyectos y datos de tu
                organización no se tocan — siguen ahí para el resto del equipo.
              </>
            )}
          </p>
          <p className="mt-4 text-xs text-muted">
            Escribe &ldquo;{CONFIRM_PHRASE}&rdquo; para confirmar
          </p>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mt-2 w-full max-w-sm border rounded-lg border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
            autoComplete="off"
          />

          {state?.error && (
            <FormError message={state.error} className="mt-3" />
          )}

          <div className="mt-5 flex items-center gap-4">
            <form action={formAction}>
              <button
                type="submit"
                disabled={!canSubmit || pending}
                className="btn btn-primary"
              >
                {pending ? "Borrando…" : "Borrar definitivamente"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
              className="link-action"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
