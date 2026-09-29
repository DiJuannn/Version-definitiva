"use client";

import { saveStyleAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field, Textarea } from "@/components/ui/field";
import { STYLE_FIELDS, type StyleData } from "@/lib/domain/style";

export function StyleForm({ clientId, data }: { clientId: string; data: StyleData }) {
  return (
    <ActionForm action={saveStyleAction} className="p-4">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        {STYLE_FIELDS.map((f) => (
          <Field key={f.key} label={f.label} htmlFor={`st-${f.key}`} optional>
            <Textarea id={`st-${f.key}`} name={f.key} rows={2} defaultValue={data[f.key] ?? ""} />
          </Field>
        ))}
      </div>
      <div className="mt-4">
        <SubmitButton>Guardar nueva versión</SubmitButton>
      </div>
    </ActionForm>
  );
}
