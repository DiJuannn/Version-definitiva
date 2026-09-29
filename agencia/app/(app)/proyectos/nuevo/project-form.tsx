"use client";

import { useState } from "react";
import { createProjectAction } from "@/app/actions/work";
import { ActionForm, FieldError, SubmitButton } from "@/components/ui/action-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

type Opt = { id: string; name: string };

export function ProjectForm({
  clients,
  coordinators,
  teams,
  packages,
  defaultClientId,
  isAdmin,
}: {
  clients: Opt[];
  coordinators: Opt[];
  teams: Opt[];
  packages: (Opt & { clientId: string | null })[];
  defaultClientId?: string;
  isAdmin: boolean;
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  return (
    <ActionForm action={createProjectAction} className="max-w-2xl rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" htmlFor="clientId" className="sm:col-span-2">
          <Select id="clientId" name="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Elige un cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <FieldError name="clientId" />
        </Field>
        <Field label="Nombre del proyecto" htmlFor="name" className="sm:col-span-2">
          <Input id="name" name="name" required placeholder="Campaña de primavera" />
          <FieldError name="name" />
        </Field>
        <Field label="Descripción" htmlFor="description" className="sm:col-span-2" optional>
          <Textarea id="description" name="description" rows={3} />
        </Field>
        <Field label="Tipo de contenido" htmlFor="contentType" optional>
          <Input id="contentType" name="contentType" placeholder="Redes sociales, publicidad…" />
        </Field>
        <Field label="Prioridad" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="NORMAL">
            <option value="LOW">Baja</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </Select>
        </Field>
        <Field label="Fecha de entrega" htmlFor="dueDate" optional>
          <Input id="dueDate" name="dueDate" type="date" />
        </Field>
        {isAdmin && (
          <Field label="Coordinador" htmlFor="coordinatorId" optional>
            <Select id="coordinatorId" name="coordinatorId" defaultValue="">
              <option value="">Sin asignar</option>
              {coordinators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Equipo" htmlFor="teamId" optional>
          <Select id="teamId" name="teamId" defaultValue="">
            <option value="">Sin equipo</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Paquete de servicio" htmlFor="packageId" optional hint="Déjalo vacío para un proyecto suelto.">
          <Select id="packageId" name="packageId" defaultValue="">
            <option value="">Proyecto suelto</option>
            {packages
              .filter((p) => !p.clientId || p.clientId === clientId)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </Select>
        </Field>
        <Field label="Notas internas" htmlFor="internalNotes" className="sm:col-span-2" optional hint="Solo las ve el equipo de la agencia.">
          <Textarea id="internalNotes" name="internalNotes" rows={2} />
        </Field>
      </div>
      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <SubmitButton pendingLabel="Creando…">Crear proyecto</SubmitButton>
        <p className="text-[13px] text-ink-3">Después podrás añadir piezas y completar el brief.</p>
      </div>
    </ActionForm>
  );
}
