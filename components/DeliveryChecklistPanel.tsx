"use client";

import { useState, useTransition } from "react";
import { createDeliveryChecklist } from "@/lib/actions/delivery-checklist";
import { createTask, deleteTask, updateTaskStatus } from "@/lib/actions/tasks";
import { DELIVERY_CATEGORY } from "@/lib/delivery-checklist";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";

export type DeliveryTaskView = { id: string; title: string; status: string };

function Item({ task }: { task: DeliveryTaskView }) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "DONE";

  return (
    <li className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          defaultChecked={done}
          disabled={pending}
          onChange={(e) => {
            const fd = new FormData();
            fd.set("status", e.currentTarget.checked ? "DONE" : "PENDING");
            startTransition(() => updateTaskStatus(task.id, fd));
          }}
          className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span className={`truncate font-sans text-sm ${done ? "text-muted line-through" : "text-fg"}`}>{task.title}</span>
      </label>
      <form action={deleteTask.bind(null, task.id)}>
        <DeleteButton confirmMessage="¿Quitar esto de la checklist?" className="link-action shrink-0" />
      </form>
    </li>
  );
}

// Montaje → Entrega: lo típico que hace falta para entregar el proyecto (máster, subtítulos,
// cartel…), como Tareas normales con category "Entrega" — se ven también en Tareas, sin duplicar
// el sistema de pendientes.
export function DeliveryChecklistPanel({ projectId, tasks }: { projectId: string; tasks: DeliveryTaskView[] }) {
  const [adding, setAdding] = useState(false);
  const done = tasks.filter((t) => t.status === "DONE").length;

  if (tasks.length === 0) {
    return (
      <div>
        <p className="max-w-2xl font-sans text-sm text-muted">
          Lo típico que hace falta para entregar el proyecto: el máster, la copia sin títulos, subtítulos, cartel y
          demás. Te dejo preparada la lista de siempre; márcalos según los vayas teniendo, o añade los tuyos.
        </p>
        <div className="mt-5">
          <ActionButtonForm
            action={createDeliveryChecklist.bind(null, projectId)}
            pendingLabel="Creando…"
            className="btn btn-primary"
          >
            Crear la checklist
          </ActionButtonForm>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
        {done}/{tasks.length} listos
      </p>
      <ul className="mt-3 border-t border-line">
        {tasks.map((task) => (
          <Item key={task.id} task={task} />
        ))}
      </ul>

      <button type="button" onClick={() => setAdding((v) => !v)} className="link-action mt-4">
        {adding ? "− Cancelar" : "+ Añadir algo más"}
      </button>
      {adding && (
        <form
          action={(fd) => {
            createTask(fd);
            setAdding(false);
          }}
          className="mt-3 flex max-w-md items-end gap-2"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="category" value={DELIVERY_CATEGORY} />
          <input
            name="title"
            required
            placeholder="Ej. Versión para redes sociales"
            className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <SubmitButton pendingLabel="Añadiendo…" className="btn btn-secondary shrink-0">
            Añadir
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
