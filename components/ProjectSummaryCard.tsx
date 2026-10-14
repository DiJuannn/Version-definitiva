"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ProjectStatus } from "@/lib/generated/prisma";
import { PROJECT_STATUS_LABELS as STATUS_LABELS } from "@/lib/labels";
import { ChipOption } from "@/components/ChipOption";
import { useToast } from "@/components/Toast";

// Cierra el formulario y avisa cuando el guardado termina de verdad (antes se
// cerraba al enviar, sin pending ni confirmación).
function SaveRow({ onDone }: { onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return (
    <button type="submit" disabled={pending} className="btn btn-primary">
      {pending && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {pending ? "Guardando…" : "Guardar la ficha"}
    </button>
  );
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("es-ES");
}

function formatCurrency(value: number): string {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

type Project = {
  id: string;
  name: string;
  type: string | null;
  status: ProjectStatus;
  director: string | null;
  producer: string | null;
  durationLabel: string | null;
  startDate: Date | null;
  endDate: Date | null;
  budgetTarget: number | null;
  notes: string | null;
};

export function ProjectSummaryCard({
  project,
  updateAction,
}: {
  project: Project;
  updateAction: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const { toast } = useToast();

  if (!editing) {
    const fields = [
      { label: "Tipo", value: project.type },
      { label: "Estado", value: STATUS_LABELS[project.status] },
      { label: "Director", value: project.director },
      { label: "Producción", value: project.producer },
      { label: "Duración", value: project.durationLabel },
      {
        label: "Presupuesto previsto",
        value:
          project.budgetTarget !== null
            ? formatCurrency(project.budgetTarget)
            : null,
      },
      {
        label: "Fechas",
        value:
          project.startDate || project.endDate
            ? `${formatDate(project.startDate) || "?"} — ${formatDate(project.endDate) || "?"}`
            : null,
      },
    ].filter((field) => field.value);

    // Ficha en una hoja de papel, como lista de definiciones: etiqueta a la izquierda, dato a la
    // derecha, una raya entre filas (sin cajas dentro).
    return (
      <section aria-labelledby="project-facts-title" className="sheet p-6 sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="project-facts-title" className="font-display text-lg font-black tracking-tight">
            Ficha del proyecto
          </h2>
          <button type="button" onClick={() => setEditing(true)} className="link-action">
            Editar
          </button>
        </div>

        {fields.length === 0 && !project.notes ? (
          <div className="mt-4 border-t border-line pt-5">
            <p className="max-w-md font-sans text-sm leading-relaxed text-muted">
              Director, producción, duración, fechas y presupuesto previsto: los datos que salen en el dossier.
            </p>
            <button type="button" onClick={() => setEditing(true)} className="btn btn-outline mt-4">
              Rellenar la ficha
            </button>
          </div>
        ) : (
          <dl className="mt-4 divide-y divide-line border-t border-line">
            {fields.map((field) => (
              <div key={field.label} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-4 py-3">
                <dt className="pt-0.5 font-sans text-[13px] text-muted">{field.label}</dt>
                <dd className="font-sans text-sm">{field.value}</dd>
              </div>
            ))}
            {project.notes && (
              <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-4 py-3">
                <dt className="pt-0.5 font-sans text-[13px] text-muted">Notas</dt>
                <dd className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted">{project.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </section>
    );
  }

  const LBL = "font-sans text-[13px] text-muted";

  return (
    <form
      action={updateAction}
      aria-label="Editar la ficha del proyecto"
      className="sheet grid gap-x-5 gap-y-4 p-6 sm:grid-cols-2 sm:p-8"
    >
      <div className="flex items-baseline justify-between sm:col-span-2">
        <h2 className="font-display text-lg font-black tracking-tight">Editar la ficha</h2>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="link-action"
        >
          Cancelar
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Nombre
        </span>
        <input
          name="name"
          defaultValue={project.name}
          required
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Tipo
        </span>
        <input
          name="type"
          defaultValue={project.type ?? ""}
          placeholder="Cortometraje, spot, serie..."
          className="field px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={LBL}>
          Estado
        </span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <ChipOption
              key={value}
              type="radio"
              name="status"
              value={value}
              label={label}
              defaultChecked={project.status === value}
            />
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Director
        </span>
        <input
          name="director"
          defaultValue={project.director ?? ""}
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Producción
        </span>
        <input
          name="producer"
          defaultValue={project.producer ?? ""}
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Duración
        </span>
        <input
          name="durationLabel"
          defaultValue={project.durationLabel ?? ""}
          placeholder="12 min"
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Presupuesto previsto (€)
        </span>
        <input
          type="number"
          step="0.01"
          name="budgetTarget"
          defaultValue={project.budgetTarget ?? ""}
          placeholder="Ej. 15000"
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Fecha de inicio
        </span>
        <input
          type="date"
          name="startDate"
          defaultValue={toDateInputValue(project.startDate)}
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={LBL}>
          Fecha de fin
        </span>
        <input
          type="date"
          name="endDate"
          defaultValue={toDateInputValue(project.endDate)}
          className="field px-3 py-2 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className={LBL}>
          Notas
        </span>
        <textarea
          name="notes"
          defaultValue={project.notes ?? ""}
          rows={3}
          className="field px-3 py-2 text-sm"
        />
      </label>

      <div className="flex items-center gap-4 border-t border-line pt-5 sm:col-span-2">
        <SaveRow
          onDone={() => {
            setEditing(false);
            toast("success", "Datos del proyecto guardados");
          }}
        />
        <button type="button" onClick={() => setEditing(false)} className="link-action">
          Cancelar
        </button>
      </div>
    </form>
  );
}
