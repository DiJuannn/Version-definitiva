"use client";

import { useState } from "react";
import { addLinkAction, createPieceAction } from "@/app/actions/work";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export function AddPieceForm({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        Añadir pieza
      </Button>
    );
  }
  return (
    <div className="w-full border-t border-line bg-surface-2 p-4">
      <ActionForm action={createPieceAction} resetOnSuccess onSuccess={() => setOpen(false)}>
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid gap-3 sm:grid-cols-6">
          <Field label="Título" htmlFor="piece-title" className="sm:col-span-3">
            <Input id="piece-title" name="title" required placeholder="Reel de lanzamiento" autoFocus />
            <FieldError name="title" />
          </Field>
          <Field label="Formato" htmlFor="piece-format" className="sm:col-span-3" optional>
            <Input id="piece-format" name="format" placeholder="Reel, spot, entrevista…" />
          </Field>
          <Field label="Relación de aspecto" htmlFor="piece-ar" className="sm:col-span-2">
            <Select id="piece-ar" name="aspectRatio" defaultValue="16:9">
              <option>16:9</option>
              <option>9:16</option>
              <option>1:1</option>
              <option>4:5</option>
              <option>2.39:1</option>
            </Select>
          </Field>
          <Field label="Resolución" htmlFor="piece-res" className="sm:col-span-2" optional>
            <Input id="piece-res" name="resolution" placeholder="1920×1080" />
          </Field>
          <Field label="Duración objetivo (s)" htmlFor="piece-dur" className="sm:col-span-2" optional>
            <Input id="piece-dur" name="targetDurationSec" type="number" min={0} />
          </Field>
          <Field label="Entrega" htmlFor="piece-due" className="sm:col-span-3" optional>
            <Input id="piece-due" name="dueDate" type="date" />
          </Field>
          <Field label="Prioridad" htmlFor="piece-prio" className="sm:col-span-3">
            <Select id="piece-prio" name="priority" defaultValue="NORMAL">
              <option value="LOW">Baja</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </Select>
          </Field>
        </div>
        <div className="mt-4 flex gap-2">
          <SubmitButton size="sm">Crear pieza</SubmitButton>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
        </div>
      </ActionForm>
    </div>
  );
}

export function AddLinkForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={addLinkAction} resetOnSuccess className="flex flex-col gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select name="kind" aria-label="Tipo" className="sm:w-40" defaultValue="SOURCE">
          <option value="SOURCE">Material bruto</option>
          <option value="REFERENCE">Referencia</option>
        </Select>
        <Input name="url" type="url" placeholder="https://drive.google.com/…" aria-label="Enlace" required />
        <Input name="label" placeholder="Descripción (opcional)" aria-label="Descripción" className="sm:w-56" />
        <SubmitButton size="md" variant="secondary">Añadir</SubmitButton>
      </div>
      <FieldError name="url" />
    </ActionForm>
  );
}
