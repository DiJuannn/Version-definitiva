"use client";

import { requestProjectAction } from "@/app/actions/work";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Textarea } from "@/components/ui/field";

export function RequestForm() {
  return (
    <ActionForm action={requestProjectAction} className="max-w-xl rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-col gap-4">
        <Field label="¿Cómo se llama el proyecto?" htmlFor="name">
          <Input id="name" name="name" required placeholder="Vídeos de la feria de octubre" />
          <FieldError name="name" />
        </Field>
        <Field label="¿Qué necesitas?" htmlFor="description" optional>
          <Textarea id="description" name="description" rows={4} placeholder="Número de vídeos, para qué redes, cualquier idea…" />
        </Field>
        <Field label="¿Para cuándo?" htmlFor="dueDate" optional>
          <Input id="dueDate" name="dueDate" type="date" />
        </Field>
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <SubmitButton pendingLabel="Enviando…">Enviar solicitud y seguir con el brief</SubmitButton>
      </div>
    </ActionForm>
  );
}
