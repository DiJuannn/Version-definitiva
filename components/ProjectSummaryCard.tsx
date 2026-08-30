"use client";

import { useState } from "react";
import { ProjectStatus } from "@/lib/generated/prisma";
import { PROJECT_STATUS_LABELS as STATUS_LABELS } from "@/lib/labels";
import { ChipOption } from "@/components/ChipOption";

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

    return (
      <div className="mt-8 border border-line p-5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Resumen
          </p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
          >
            Editar
          </button>
        </div>

        {fields.length === 0 && !project.notes ? (
          <p className="mt-4 font-mono text-sm text-muted">
            Sin datos todavía — pulsa &ldquo;Editar&rdquo; para rellenarlos.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <div key={field.label}>
                <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  {field.label}
                </p>
                <p className="mt-0.5 font-mono text-sm">{field.value}</p>
              </div>
            ))}
          </div>
        )}

        {project.notes && (
          <p className="mt-4 whitespace-pre-wrap font-mono text-sm text-muted">
            {project.notes}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={updateAction}
      onSubmit={() => setEditing(false)}
      className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <div className="flex items-center justify-between sm:col-span-2 lg:col-span-3">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Resumen
        </p>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
        >
          Cancelar
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Nombre
        </span>
        <input
          name="name"
          defaultValue={project.name}
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Tipo
        </span>
        <input
          name="type"
          defaultValue={project.type ?? ""}
          placeholder="Cortometraje, spot, serie..."
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
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
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Director
        </span>
        <input
          name="director"
          defaultValue={project.director ?? ""}
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Producción
        </span>
        <input
          name="producer"
          defaultValue={project.producer ?? ""}
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Duración
        </span>
        <input
          name="durationLabel"
          defaultValue={project.durationLabel ?? ""}
          placeholder="12 min"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Presupuesto previsto (€)
        </span>
        <input
          type="number"
          step="0.01"
          name="budgetTarget"
          defaultValue={project.budgetTarget ?? ""}
          placeholder="Ej. 15000"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Fecha de inicio
        </span>
        <input
          type="date"
          name="startDate"
          defaultValue={toDateInputValue(project.startDate)}
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Fecha de fin
        </span>
        <input
          type="date"
          name="endDate"
          defaultValue={toDateInputValue(project.endDate)}
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
        <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Notas
        </span>
        <textarea
          name="notes"
          defaultValue={project.notes ?? ""}
          rows={3}
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <div>
        <button
          type="submit"
          className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
