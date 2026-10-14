"use client";

import { useActionState, useState } from "react";
import { deleteOwnAccount } from "@/lib/actions/account";

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
    // Aviso con barra roja a la izquierda, no un recuadro.
    <div className="mt-4 max-w-2xl">
      <p className="font-display text-lg font-bold">Eliminar mi cuenta</p>

      {!open ? (
        <>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
            Borra tu usuario y tu acceso al Taller. Es permanente y no se puede deshacer.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn btn-outline btn-sm mt-4 hover:!border-danger hover:!text-danger"
          >
            Quiero eliminar mi cuenta
          </button>
        </>
      ) : (
        <div className="mt-1">
          <p className="font-sans text-sm leading-relaxed text-muted">
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
          <label className="mt-5 block max-w-sm">
            <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
              Escribe &ldquo;{CONFIRM_PHRASE}&rdquo; para confirmar
            </span>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="field-line font-mono uppercase"
              autoComplete="off"
            />
          </label>

          {state?.error && (
            <p role="alert" className="mt-3 font-sans text-sm text-danger">{state.error}</p>
          )}

          <div className="mt-5 flex items-center gap-4">
            <form action={formAction}>
              <button
                type="submit"
                disabled={!canSubmit || pending}
                className="btn btn-danger"
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
    </div>
  );
}
