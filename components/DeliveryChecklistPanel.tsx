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
    <li className="flex items-center justify-between gap-3 py-3.5">
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
        <span
          className={`truncate font-sans text-[15px] ${done ? "text-muted line-through" : "text-fg"}`}
        >
          {task.title}
        </span>
      </label>
      <form action={deleteTask.bind(null, task.id)}>
        <DeleteButton
          confirmMessage="¿Quitar esto de la checklist?"
          aria-label={`Quitar «${task.title}» de la checklist`}
          className="link-action shrink-0 px-1.5 hover:!text-danger"
        >
          ✕
        </DeleteButton>
      </form>
    </li>
  );
}

// Montaje → Entrega: lo típico que hace falta para entregar el proyecto (máster, subtítulos,
// cartel…), como Tareas normales con category "Entrega" — se ven también en Tareas, sin duplicar
// el sistema de pendientes.
export function DeliveryChecklistPanel({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: DeliveryTaskView[];
}) {
  const [adding, setAdding] = useState(false);
  const done = tasks.filter((t) => t.status === "DONE").length;

  if (tasks.length === 0) {
    return (
      <div>
        <p className="max-w-2xl font-sans text-[15px] leading-relaxed text-muted">
          Lo típico que hace falta para entregar el proyecto: el máster, la
          copia sin títulos, subtítulos, cartel y demás. Te dejo preparada la
          lista de siempre; márcalos según los vayas teniendo, o añade los
          tuyos.
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
    <div className="max-w-3xl">
      {/* Progreso como cifra y barra, sin caja. */}
      <div className="flex items-end gap-6">
        <p className="font-display text-3xl leading-none font-black tabular-nums">
          {done}
          <span className="text-muted">/{tasks.length}</span>
        </p>
        <div className="flex-1 pb-1">
          <p className="eyebrow">
            {done === tasks.length
              ? "Todo listo para entregar"
              : "Listos para entregar"}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-success"
              style={{ width: `${Math.round((done / tasks.length) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="sheet mt-6 px-5 sm:px-8">
        <ul className="divide-y divide-line">
          {tasks.map((task) => (
            <Item key={task.id} task={task} />
          ))}
        </ul>
        <div className="border-t border-line py-3">
          {adding ? (
            <form
              action={(fd) => {
                createTask(fd);
                setAdding(false);
              }}
              className="flex items-end gap-3"
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="category" value={DELIVERY_CATEGORY} />
              <label className="min-w-0 flex-1">
                <span className="sr-only">Qué más hace falta entregar</span>
                <input
                  name="title"
                  required
                  autoFocus
                  placeholder="Ej. Versión para redes sociales"
                  className="field-line mt-0"
                />
              </label>
              <SubmitButton
                pendingLabel="Añadiendo…"
                className="btn btn-secondary btn-sm shrink-0"
              >
                Añadir
              </SubmitButton>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="link-action shrink-0"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="link-action hover:!text-accent"
            >
              + Añadir algo más
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
