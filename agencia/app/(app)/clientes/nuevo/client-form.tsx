"use client";

import { createClientAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/field";

export function ClientForm() {
  return (
    <ActionForm action={createClientAction} className="flex max-w-xl flex-col gap-4 rounded-lg border border-line bg-surface p-5">
      <Field label="Nombre" htmlFor="c-name">
        <Input id="c-name" name="name" required />
        <FieldError name="name" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Persona de contacto" htmlFor="c-contact" optional>
          <Input id="c-contact" name="contactName" />
        </Field>
        <Field label="Email de contacto" htmlFor="c-email" optional>
          <Input id="c-email" name="contactEmail" type="email" />
          <FieldError name="contactEmail" />
        </Field>
      </div>
      <Field label="Notas internas" htmlFor="c-notes" optional>
        <Textarea id="c-notes" name="notes" rows={3} />
      </Field>
      <div>
        <SubmitButton>Crear cliente</SubmitButton>
      </div>
    </ActionForm>
  );
}
