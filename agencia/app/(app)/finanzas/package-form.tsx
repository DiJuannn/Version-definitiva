"use client";

import { createPackageAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";

export function PackageForm({ clients }: { clients: { id: string; name: string }[] }) {
  return (
    <ActionForm action={createPackageAction} resetOnSuccess className="grid gap-3 p-4 sm:grid-cols-2">
      <Field label="Nombre" htmlFor="pk-name" className="sm:col-span-2">
        <Input id="pk-name" name="name" />
        <FieldError name="name" />
      </Field>
      <Field label="Cliente" htmlFor="pk-client" optional>
        <Select id="pk-client" name="clientId" defaultValue="">
          <option value="">Cualquier cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Periodo" htmlFor="pk-period">
        <Select id="pk-period" name="period" defaultValue="MONTHLY">
          <option value="ONE_OFF">Pago único</option>
          <option value="MONTHLY">Mensual</option>
          <option value="QUARTERLY">Trimestral</option>
        </Select>
      </Field>
      <Field label="Piezas incluidas" htmlFor="pk-n">
        <Input id="pk-n" name="piecesIncluded" type="number" min={1} />
        <FieldError name="piecesIncluded" />
      </Field>
      <Field label="Precio" htmlFor="pk-price">
        <Input id="pk-price" name="price" inputMode="decimal" />
      </Field>
      <Field label="Moneda" htmlFor="pk-cur">
        <Input id="pk-cur" name="currency" defaultValue="EUR" maxLength={3} />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="sm">Crear paquete</SubmitButton>
      </div>
    </ActionForm>
  );
}
