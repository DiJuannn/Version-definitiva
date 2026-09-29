"use client";

import { changePasswordAction } from "@/app/actions/auth";
import { editorProfileAction, notificationPrefsAction } from "@/app/actions/admin";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="flex flex-col gap-3 p-4">
      <Field label="Contraseña actual" htmlFor="pw-cur">
        <Input id="pw-cur" name="current" type="password" autoComplete="current-password" />
        <FieldError name="current" />
      </Field>
      <Field label="Nueva contraseña" htmlFor="pw-new" hint="Mínimo 10 caracteres, con letras y números.">
        <Input id="pw-new" name="next" type="password" autoComplete="new-password" />
        <FieldError name="next" />
      </Field>
      <div>
        <SubmitButton size="sm">Cambiar contraseña</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AvailabilityForm({ userId, availability, note, capacity }: { userId: string; availability: string; note: string; capacity: number }) {
  return (
    <ActionForm action={editorProfileAction} className="flex flex-col gap-3 p-4">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="capacity" value={capacity} />
      <Field label="Estado" htmlFor="av">
        <Select id="av" name="availability" defaultValue={availability}>
          <option value="AVAILABLE">Disponible</option>
          <option value="LIMITED">Disponibilidad limitada</option>
          <option value="UNAVAILABLE">No disponible</option>
        </Select>
      </Field>
      <Field label="Nota" htmlFor="av-note" optional>
        <Input id="av-note" name="availabilityNote" defaultValue={note} placeholder="Vacaciones hasta el lunes…" />
      </Field>
      <div>
        <SubmitButton size="sm">Guardar</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PrefsForm({ types, prefs }: { types: [string, string][]; prefs: { type: string; inApp: boolean; email: boolean }[] }) {
  const get = (t: string) => prefs.find((p) => p.type === t) ?? { inApp: true, email: true };
  return (
    <ActionForm action={notificationPrefsAction}>
      <table className="w-full text-sm">
        <thead className="text-left text-[12px] text-ink-3">
          <tr>
            <th className="px-4 py-2 font-medium">Aviso</th>
            <th className="w-20 px-2 py-2 text-center font-medium">En la app</th>
            <th className="w-20 px-2 py-2 text-center font-medium">Email</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {types.map(([k, label]) => (
            <tr key={k}>
              <td className="px-4 py-2">{label}</td>
              <td className="text-center">
                <input type="checkbox" name={`${k}:inApp`} defaultChecked={get(k).inApp} aria-label={`${label} en la app`} className="size-4 accent-[var(--ink)]" />
              </td>
              <td className="text-center">
                <input type="checkbox" name={`${k}:email`} defaultChecked={get(k).email} aria-label={`${label} por email`} className="size-4 accent-[var(--ink)]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-line p-4">
        <SubmitButton size="sm">Guardar preferencias</SubmitButton>
      </div>
    </ActionForm>
  );
}
