"use client";

import { createTeamAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";

export function TeamForm({ coordinators }: { coordinators: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createTeamAction} resetOnSuccess className="flex flex-col gap-3 p-4">
      <Field label="Nombre" htmlFor="t-name">
        <Input id="t-name" name="name" />
        <FieldError name="name" />
      </Field>
      <Field label="Coordinador" htmlFor="t-coord">
        <Select id="t-coord" name="coordinatorId" defaultValue="">
          <option value="">Elige…</option>
          {coordinators.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <FieldError name="coordinatorId" />
      </Field>
      <div>
        <SubmitButton size="sm">Crear equipo</SubmitButton>
      </div>
    </ActionForm>
  );
}
