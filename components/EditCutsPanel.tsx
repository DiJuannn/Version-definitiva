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

// Color del estado: solo para estado (borrador apagado, revisión ámbar, final verde).
const STATUS_RING: Record<string, string> = {
  FINAL: "border-success bg-success text-bg",
  REVIEW: "border-warn text-warn",
  DRAFT: "border-muted text-muted",
};
const STATUS_TEXT: Record<string, string> = {
  FINAL: "text-success",
  REVIEW: "text-warn",
  DRAFT: "text-muted",
};

// Una versión en la línea de tiempo: el nodo (v1, v2…) en el raíl y, al
// lado, nombre, fecha, duración, notas y el estado.
function CutRow({
  projectId,
  cut,
  index,
  isLast,
}: {
  projectId: string;
  cut: EditCutView;
  index: number;
  isLast: boolean;
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
    <li className="relative grid grid-cols-[3rem_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
      {/* Raíl: une cada versión con la siguiente. */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-12 bottom-0 left-6 w-px bg-line sm:left-7"
        />
      )}
      <span
        className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 font-mono text-sm font-bold sm:h-14 sm:w-14 sm:text-base ${STATUS_RING[cut.status] ?? STATUS_RING.DRAFT} ${cut.status === "FINAL" ? "" : "bg-bg"}`}
      >
        v{index + 1}
      </span>
      <div className="min-w-0 pt-1.5 sm:pt-2.5">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-xl leading-tight font-bold">
            {cut.name}
          </span>
          {isLast && (
            <span className="font-mono text-[10px] tracking-widest text-accent uppercase">
              Última versión
            </span>
          )}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {meta || "Sin fecha ni duración"}
        </p>
        {cut.notes && (
          <p className="mt-2 max-w-2xl font-sans text-[15px] leading-relaxed">
            {cut.notes}
          </p>
        )}
      </div>
      <div className="col-start-2 mt-3 flex items-center gap-3 sm:col-start-auto sm:mt-0 sm:self-start sm:pt-2.5">
        <form
          action={(fd) => {
            fd.set("durationLabel", cut.durationLabel ?? "");
            fd.set("date", cut.date ? cut.date.slice(0, 10) : "");
            fd.set("notes", cut.notes ?? "");
            startTransition(() => action(fd));
          }}
          className="flex items-center gap-2"
        >
          <label className="sr-only" htmlFor={`cut-status-${cut.id}`}>
            Estado de {cut.name}
          </label>
          <select
            id={`cut-status-${cut.id}`}
            name="status"
            defaultValue={cut.status}
            disabled={pending}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={`field py-1.5 pl-2 font-mono text-[11px] tracking-widest uppercase disabled:opacity-60 ${STATUS_TEXT[cut.status] ?? ""}`}
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
          Cada versión del montaje que enseñas o revisas, en orden: cuándo,
          cuánto dura y qué se dijo al verla. El vídeo se queda donde montes.
        </p>
        {cuts.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="btn btn-primary"
          >
            {open ? "Cerrar" : "+ Nueva versión"}
          </button>
        )}
      </div>

      {open && (
        <form
          action={(fd) => {
            createAction(fd);
            setOpen(cuts.length === 0);
          }}
          className="paper mt-6 grid gap-x-5 gap-y-4 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4"
        >
          <p className="font-display text-lg font-bold sm:col-span-2 lg:col-span-4">
            {cuts.length === 0 ? "Apunta la primera versión" : "Nueva versión"}
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
              Añadir versión
            </SubmitButton>
          </div>
        </form>
      )}

      {cuts.length > 0 && (
        <ol aria-label="Versiones del montaje" className="mt-10 max-w-4xl">
          {cuts.map((cut, index) => (
            <CutRow
              key={cut.id}
              projectId={projectId}
              cut={cut}
              index={index}
              isLast={index === cuts.length - 1}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
