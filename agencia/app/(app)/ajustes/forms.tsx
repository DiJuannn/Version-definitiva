"use client";

import { useState } from "react";
import { createUserAction, resetPasswordAction, updateOrgAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";

export function UserForm({ clients }: { clients: { id: string; name: string }[] }) {
  const [role, setRole] = useState("EDITOR");
  return (
    <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3 p-4 sm:grid-cols-2">
      <Field label="Nombre" htmlFor="u-name">
        <Input id="u-name" name="name" />
        <FieldError name="name" />
      </Field>
      <Field label="Email" htmlFor="u-email">
        <Input id="u-email" name="email" type="email" autoComplete="off" />
        <FieldError name="email" />
      </Field>
      <Field label="Rol" htmlFor="u-role">
        <Select id="u-role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="ADMIN">Administración</option>
          <option value="COORDINATOR">Coordinación</option>
          <option value="EDITOR">Edición</option>
          <option value="CLIENT">Cliente</option>
        </Select>
      </Field>
      {role === "CLIENT" ? (
        <Field label="Cliente" htmlFor="u-client">
          <Select id="u-client" name="clientId" defaultValue="">
            <option value="">Elige…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <FieldError name="clientId" />
        </Field>
      ) : role === "COORDINATOR" ? (
        <div className="flex items-end pb-2">
          <Checkbox name="canViewFinance" label="Puede ver finanzas de sus proyectos" />
        </div>
      ) : (
        <span />
      )}
      <Field label="Contraseña inicial" htmlFor="u-pw" hint="Mínimo 10 caracteres, con letras y números." className="sm:col-span-2">
        <Input id="u-pw" name="password" type="text" autoComplete="off" />
        <FieldError name="password" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Crear usuario</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] text-ink-2 hover:text-ink">
        Restablecer contraseña
      </button>
    );
  return (
    <ActionForm action={resetPasswordAction} onSuccess={() => setOpen(false)} className="flex w-full items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input name="password" type="text" placeholder="Nueva contraseña" aria-label="Nueva contraseña" className="h-8" autoComplete="off" />
      <SubmitButton size="sm">Guardar</SubmitButton>
    </ActionForm>
  );
}

export function OrgForm({
  org,
  aiConfigured,
}: {
  org: { name: string; currency: string; taxPct: string; approvalPolicy: string; clientRequests: boolean; aiEnabled: boolean };
  aiConfigured: boolean;
}) {
  return (
    <ActionForm action={updateOrgAction} className="flex flex-col gap-3 p-4">
      <Field label="Nombre" htmlFor="o-name">
        <Input id="o-name" name="name" defaultValue={org.name} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Moneda" htmlFor="o-cur">
          <Input id="o-cur" name="currency" defaultValue={org.currency} maxLength={3} />
          <FieldError name="currency" />
        </Field>
        <Field label="Impuesto por defecto (%)" htmlFor="o-tax">
          <Input id="o-tax" name="taxPct" inputMode="decimal" defaultValue={org.taxPct} />
        </Field>
      </div>
      <Field label="Aprobar con correcciones abiertas" htmlFor="o-pol">
        <Select id="o-pol" name="approvalPolicy" defaultValue={org.approvalPolicy}>
          <option value="ALLOW_WITH_ACK">Permitir con confirmación explícita</option>
          <option value="BLOCK_IF_OPEN">No permitir hasta resolverlas o descartarlas</option>
        </Select>
      </Field>
      <Checkbox name="clientRequests" label="Los clientes pueden crear solicitudes" defaultChecked={org.clientRequests} />
      <Checkbox
        name="aiEnabled"
        label="Permitir enviar textos de clientes a un proveedor de IA"
        hint={aiConfigured ? "Proveedor configurado en el servidor." : "No hay proveedor configurado: aunque lo actives, no se enviará nada."}
        defaultChecked={org.aiEnabled}
      />
      <div>
        <SubmitButton size="sm">Guardar ajustes</SubmitButton>
      </div>
    </ActionForm>
  );
}
