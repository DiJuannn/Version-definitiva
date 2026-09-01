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
    <form action={formAction} className="mt-4 flex flex-wrap gap-3">
      <input
        name="email"
        type="email"
        placeholder="email@ejemplo.com"
        required
        className="min-w-[220px] flex-1 border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <select
        name="role"
        defaultValue="MEMBER"
        className="border border-line bg-transparent px-3 py-2 font-mono text-xs uppercase outline-none focus:border-accent"
      >
        <option value="MEMBER" className="bg-bg">
          Miembro
        </option>
        <option value="ADMIN" className="bg-bg">
          Admin
        </option>
      </select>
      <SubmitButton
        pendingLabel="Invitando…"
        savedLabel={state && "success" in state ? "✓ Invitación creada" : undefined}
        className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
      >
        Invitar
      </SubmitButton>
      {state && "error" in state && (
        <p className="w-full font-mono text-xs text-accent">{state.error}</p>
      )}
    </form>
  );
}
