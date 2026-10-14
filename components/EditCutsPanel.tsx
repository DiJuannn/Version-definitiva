"use client";

import { useState, useTransition } from "react";
import {
  createEditCut,
  deleteEditCut,
  updateEditCut,
} from "@/lib/actions/edit-cuts";
import { EDIT_CUT_STATUS_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";

export type EditCutView = {
  id: string;
  name: string;
  durationLabel: string | null;
  date: string | null;
  status: string;
  notes: string | null;
};

const INPUT = "field w-full";

const STATUS_DOT: Record<string, string> = {
  FINAL: "bg-success",
  REVIEW: "bg-warn",
  DRAFT: "bg-muted",
};

function CutRow({
  projectId,
  cut,
  index,
}: {
  projectId: string;
  cut: EditCutView;
  index: number;
}) {
  const [pending, startTransition] = useTransition();
  const action = updateEditCut.bind(null, projectId, cut.id);
  const meta = [
    cut.date
      ? new Date(cut.date).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
        })
      : null,
    cut.durationLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="grid grid-cols-[2rem_1fr] gap-x-4 gap-y-3 py-5 sm:grid-cols-[2.5rem_1fr_auto]">
      <span className="font-display text-2xl leading-none font-black text-muted tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight font-bold">
          {cut.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {meta || "Sin fecha ni duración"}
        </p>
        {cut.notes && (
          <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed">
            {cut.notes}
          </p>
        )}
      </div>
      <div className="col-start-2 flex items-center gap-3 sm:col-start-auto sm:self-start">
        <form
          action={(fd) => {
            fd.set("durationLabel", cut.durationLabel ?? "");
            fd.set("date", cut.date ? cut.date.slice(0, 10) : "");
            fd.set("notes", cut.notes ?? "");
            startTransition(() => action(fd));
          }}
          className="flex items-center gap-2"
        >
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[cut.status] ?? "bg-muted"}`}
          />
          <label className="sr-only" htmlFor={`cut-status-${cut.id}`}>
            Estado de {cut.name}
          </label>
          <select
            id={`cut-status-${cut.id}`}
            name="status"
            defaultValue={cut.status}
            disabled={pending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="field py-1.5 pl-2 font-mono text-[11px] tracking-widest uppercase disabled:opacity-60"
          >
            {Object.entries(EDIT_CUT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </form>
        <form action={deleteEditCut.bind(null, projectId, cut.id)}>
          <DeleteButton
            confirmMessage="¿Eliminar este corte del registro?"
            aria-label={`Eliminar ${cut.name}`}
            className="link-action px-1.5 hover:!text-danger"
          >
            ✕
          </DeleteButton>
        </form>
      </div>
    </li>
  );
}

// Montaje → Cortes: un registro de las versiones del montaje (no el archivo en sí, solo el
// seguimiento) para no perder de vista cuál es la última y qué se dijo de ella.
export function EditCutsPanel({
  projectId,
  cuts,
}: {
  projectId: string;
  cuts: EditCutView[];
}) {
  // Vacío: el formulario se ve directo como primer paso. Con cortes, tras un botón.
  const [open, setOpen] = useState(cuts.length === 0);
  const createAction = createEditCut.bind(null, projectId);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="max-w-2xl font-sans text-[15px] leading-relaxed text-muted">
          Una línea por cada versión del montaje que enseñas o revisas: cuándo,
          cuánto dura y qué se dijo al verla. El vídeo se queda donde montes.
        </p>
        {cuts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="btn btn-primary"
          >
            {open ? "Cerrar" : "+ Nuevo corte"}
          </button>
        )}
      </div>

      {open && (
        <form
          action={(fd) => {
            createAction(fd);
            setOpen(cuts.length === 0);
          }}
          className="sheet mt-6 grid gap-x-5 gap-y-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4"
        >
          <p className="font-display text-lg font-bold sm:col-span-2 lg:col-span-4">
            {cuts.length === 0 ? "Apunta el primer corte" : "Nuevo corte"}
          </p>
          <FormField label="Nombre" className="lg:col-span-2">
            <input
              name="name"
              required
              placeholder={`Corte ${cuts.length + 1}`}
              className={INPUT}
            />
          </FormField>
          <FormField label="Fecha">
            <input name="date" type="date" className={INPUT} />
          </FormField>
          <FormField label="Duración">
            <input
              name="durationLabel"
              placeholder="12 min"
              className={INPUT}
            />
          </FormField>
          <FormField label="Notas" className="sm:col-span-2 lg:col-span-4">
            <input
              name="notes"
              placeholder="Qué se dijo al verlo, qué falta ajustar…"
              className={INPUT}
            />
          </FormField>
          <div>
            <SubmitButton
              pendingLabel="Añadiendo…"
              savedLabel="✓ Añadido"
              className="btn btn-secondary"
            >
              Añadir corte
            </SubmitButton>
          </div>
        </form>
      )}

      {cuts.length > 0 && (
        <ol className="sheet mt-6 divide-y divide-line px-5 sm:px-8">
          {cuts.map((cut, index) => (
            <CutRow
              key={cut.id}
              projectId={projectId}
              cut={cut}
              index={index}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
