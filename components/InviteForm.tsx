"use client";

import { useActionState } from "react";
import { createInvite } from "@/lib/actions/team";
import { SubmitButton } from "@/components/SubmitButton";

// Antes, este formulario decía "✓ Invitación enviada" pasara lo que
// pasara, incluso cuando createInvite no llegaba a crear nada (por
// ejemplo, si el email ya tenía cuenta en la plataforma) — parecía
// funcionar pero no dejaba ningún enlace para copiar. useActionState deja
// mostrar el motivo real cuando falla.
export function InviteForm() {
  const [state, formAction] = useActionState(createInvite, undefined);

  return (
    <form action={formAction} className="mt-5 grid gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">Email</span>
        <input name="email" type="email" placeholder="nombre@ejemplo.com" required className="field-line" />
      </label>
      <label className="block">
        <span className="font-mono text-[10px] tracking-[0.18em] text-muted uppercase">Entra como</span>
        <select name="role" defaultValue="MEMBER" className="field-line">
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Admin</option>
        </select>
      </label>
      <div className="mt-2 sm:col-span-2">
        <SubmitButton
          pendingLabel="Creando enlace…"
          savedLabel={state && "success" in state ? "✓ Enlace creado" : undefined}
          className="btn btn-primary"
        >
          Crear invitación
        </SubmitButton>
      </div>
      {state && "error" in state && (
        <p role="alert" className="border-l-2 border-danger pl-3 font-sans text-sm text-danger sm:col-span-2">
          {state.error}
        </p>
      )}
    </form>
  );
}
