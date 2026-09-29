"use client";

import { useState } from "react";
import { addFinanceLineAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";

export function FinanceLineForm({ projectId, currency, taxPct, editors }: { projectId: string; currency: string; taxPct: number; editors: { id: string; name: string }[] }) {
  const [kind, setKind] = useState("REVENUE");
  return (
    <ActionForm action={addFinanceLineAction} resetOnSuccess className="grid gap-3 p-4 sm:grid-cols-2">
      <input type="hidden" name="projectId" value={projectId} />
      <Field label="Tipo" htmlFor="fl-kind">
        <Select id="fl-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="REVENUE">Precio al cliente</option>
          <option value="DISCOUNT">Descuento</option>
          <option value="EDITOR_COST">Coste de edición</option>
          <option value="OTHER_COST">Otro coste</option>
        </Select>
      </Field>
      <Field label="Concepto" htmlFor="fl-desc">
        <Input id="fl-desc" name="description" />
        <FieldError name="description" />
      </Field>
      <Field label="Importe" htmlFor="fl-amount" hint="Por ejemplo 1250,00">
        <Input id="fl-amount" name="amount" inputMode="decimal" />
        <FieldError name="amount" />
      </Field>
      <Field label="Moneda" htmlFor="fl-cur">
        <Input id="fl-cur" name="currency" defaultValue={currency} maxLength={3} />
        <FieldError name="currency" />
      </Field>
      {kind === "REVENUE" && (
        <Field label="Impuesto (%)" htmlFor="fl-tax">
          <Input id="fl-tax" name="taxPct" inputMode="decimal" defaultValue={String(taxPct)} />
        </Field>
      )}
      {kind === "EDITOR_COST" && (
        <Field label="Editor" htmlFor="fl-ed">
          <Select id="fl-ed" name="editorId" defaultValue="">
            <option value="">—</option>
            {editors.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Estado" htmlFor="fl-st">
        <Select id="fl-st" name="status" defaultValue="ESTIMATED">
          <option value="ESTIMATED">Estimado</option>
          <option value="CONFIRMED">Confirmado</option>
          <option value="SETTLED">Liquidado</option>
        </Select>
      </Field>
      <Field label="Vencimiento" htmlFor="fl-due" optional>
        <Input id="fl-due" name="dueDate" type="date" />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Añadir</SubmitButton>
      </div>
    </ActionForm>
  );
}
