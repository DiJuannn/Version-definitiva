"use client";

import { editorProfileAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export function EditorProfileForm({
  userId,
  isAdmin,
  profile,
}: {
  userId: string;
  isAdmin: boolean;
  profile: { specialties: string; software: string; availability: string; availabilityNote: string; capacity: number; rate: string; internalNotes: string };
}) {
  return (
    <ActionForm action={editorProfileAction} className="flex flex-col gap-3 p-4">
      <input type="hidden" name="userId" value={userId} />
      <Field label="Especialidades" htmlFor="ep-spec" hint="Separadas por comas.">
        <Input id="ep-spec" name="specialties" defaultValue={profile.specialties} />
      </Field>
      <Field label="Software" htmlFor="ep-soft">
        <Input id="ep-soft" name="software" defaultValue={profile.software} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Disponibilidad" htmlFor="ep-av">
          <Select id="ep-av" name="availability" defaultValue={profile.availability}>
            <option value="AVAILABLE">Disponible</option>
            <option value="LIMITED">Limitada</option>
            <option value="UNAVAILABLE">No disponible</option>
          </Select>
        </Field>
        <Field label="Capacidad (piezas a la vez)" htmlFor="ep-cap">
          <Input id="ep-cap" name="capacity" type="number" min={0} max={50} defaultValue={profile.capacity} />
          <FieldError name="capacity" />
        </Field>
      </div>
      <Field label="Nota de disponibilidad" htmlFor="ep-note" optional>
        <Input id="ep-note" name="availabilityNote" defaultValue={profile.availabilityNote} />
      </Field>
      {isAdmin && (
        <>
          <Field label="Tarifa privada por pieza (EUR)" htmlFor="ep-rate" optional>
            <Input id="ep-rate" name="rate" inputMode="decimal" defaultValue={profile.rate} placeholder="180,00" />
          </Field>
          <Field label="Notas internas" htmlFor="ep-notes" optional>
            <Textarea id="ep-notes" name="internalNotes" rows={3} defaultValue={profile.internalNotes} />
          </Field>
        </>
      )}
      <div>
        <SubmitButton size="sm">Guardar perfil</SubmitButton>
      </div>
    </ActionForm>
  );
}
