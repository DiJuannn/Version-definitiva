"use client";

import { addBlockerAction, assignEditorAction, createDeliveryAction } from "@/app/actions/work";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select } from "@/components/ui/field";
import { UploadButton } from "@/components/work/upload-button";

type EditorOpt = { id: string; name: string; load: number; capacity: number; availability: string; specialties: string[] };

export function AssignForm({ pieceId, currentEditorId, editors }: { pieceId: string; currentEditorId: string | null; editors: EditorOpt[] }) {
  return (
    <ActionForm action={assignEditorAction} className="flex flex-col gap-3 p-4">
      <input type="hidden" name="pieceId" value={pieceId} />
      <Field label={currentEditorId ? "Reasignar a" : "Asignar editor"} htmlFor="editorId">
        <Select id="editorId" name="editorId" defaultValue={currentEditorId ?? ""}>
          <option value="">{currentEditorId ? "Quitar asignación" : "Elige editor…"}</option>
          {editors.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} — {e.load}/{e.capacity} piezas{e.availability === "UNAVAILABLE" ? " · no disponible" : e.availability === "LIMITED" ? " · limitada" : ""}
              {e.specialties.length ? ` · ${e.specialties.slice(0, 2).join(", ")}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      {currentEditorId && (
        <Field label="Motivo del cambio" htmlFor="assign-note" optional>
          <Input id="assign-note" name="note" placeholder="Carga, especialidad, vacaciones…" />
        </Field>
      )}
      <div>
        <SubmitButton size="sm">{currentEditorId ? "Guardar asignación" : "Asignar"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BlockerForm({ pieceId, people }: { pieceId: string; people: { id: string; name: string }[] }) {
  return (
    <ActionForm action={addBlockerAction} resetOnSuccess className="flex flex-col gap-3 border-t border-line bg-surface-2 p-4">
      <input type="hidden" name="pieceId" value={pieceId} />
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <Select name="kind" aria-label="Tipo de bloqueo" defaultValue="MISSING_MATERIAL">
          <option value="MISSING_MATERIAL">Falta material</option>
          <option value="PENDING_DECISION">Falta decisión</option>
          <option value="OTHER">Otro</option>
        </Select>
        <Input name="reason" placeholder="Qué falta exactamente" aria-label="Motivo" />
      </div>
      <FieldError name="reason" />
      <div className="flex flex-wrap items-center gap-3">
        <Select name="ownerId" aria-label="Responsable" className="sm:w-60" defaultValue="">
          <option value="">Responsable (opcional)</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <SubmitButton size="sm" variant="secondary">Registrar bloqueo</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeliveryForm({ pieceId, pending }: { pieceId: string; pending: { id: string; filename: string }[] }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <UploadButton kind="DELIVERABLE" pieceId={pieceId} label="Subir archivo final" />
      {pending.map((a) => (
        <ActionForm key={a.id} action={createDeliveryAction} className="flex flex-wrap items-end gap-2 rounded-md border border-line p-3">
          <input type="hidden" name="pieceId" value={pieceId} />
          <input type="hidden" name="assetId" value={a.id} />
          <p className="w-full text-sm font-medium">{a.filename}</p>
          <Input name="note" placeholder="Nota para el cliente (opcional)" aria-label="Nota" className="flex-1" />
          <SubmitButton size="md">Entregar al cliente</SubmitButton>
        </ActionForm>
      ))}
    </div>
  );
}
