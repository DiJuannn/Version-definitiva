"use client";

import { useState, useTransition } from "react";
import { createEditCut, deleteEditCut, updateEditCut } from "@/lib/actions/edit-cuts";
import { EDIT_CUT_STATUS_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { EmptyState } from "@/components/EmptyState";

export type EditCutView = {
  id: string;
  name: string;
  durationLabel: string | null;
  date: string | null;
  status: string;
  notes: string | null;
};

const INPUT =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "FINAL" ? "border-success/60 text-success" : status === "REVIEW" ? "border-warn/60 text-warn" : "border-line text-muted";
  return (
    <span className={`shrink-0 border px-2 py-1 font-mono text-[10px] tracking-widest uppercase ${tone}`}>
      {EDIT_CUT_STATUS_LABELS[status as keyof typeof EDIT_CUT_STATUS_LABELS] ?? status}
    </span>
  );
}

function CutRow({ projectId, cut }: { projectId: string; cut: EditCutView }) {
  const [pending, startTransition] = useTransition();
  const action = updateEditCut.bind(null, projectId, cut.id);

  return (
    <li className="border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold">{cut.name}</p>
          <p className="font-mono text-xs text-muted">
            {[cut.date ? new Date(cut.date).toLocaleDateString("es-ES") : null, cut.durationLabel].filter(Boolean).join(" · ") ||
              "Sin fecha ni duración"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={cut.status} />
          <form
            action={(fd) => {
              fd.set("durationLabel", cut.durationLabel ?? "");
              fd.set("date", cut.date ? cut.date.slice(0, 10) : "");
              fd.set("notes", cut.notes ?? "");
              startTransition(() => action(fd));
            }}
          >
            <select
              name="status"
              defaultValue={cut.status}
              disabled={pending}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="border border-line bg-transparent px-2 py-1.5 font-mono text-[11px] uppercase outline-none focus:border-accent disabled:opacity-60"
            >
              {Object.entries(EDIT_CUT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-bg">
                  {label}
                </option>
              ))}
            </select>
          </form>
          <form action={deleteEditCut.bind(null, projectId, cut.id)}>
            <DeleteButton confirmMessage="¿Eliminar este corte del registro?" className="link-action" />
          </form>
        </div>
      </div>
      {cut.notes && <p className="mt-2 max-w-2xl font-sans text-sm text-muted">{cut.notes}</p>}
    </li>
  );
}

// Montaje → Cortes: un registro de las versiones del montaje (no el archivo en sí, solo el
// seguimiento) para no perder de vista cuál es la última y qué se dijo de ella.
export function EditCutsPanel({ projectId, cuts }: { projectId: string; cuts: EditCutView[] }) {
  const [open, setOpen] = useState(cuts.length === 0);
  const createAction = createEditCut.bind(null, projectId);

  return (
    <div>
      <p className="max-w-2xl font-sans text-sm text-muted">
        Un corte por cada versión del montaje que enseñas o revisas — el número, cuándo, cuánto dura y qué se dijo al
        verla. No es el archivo de vídeo: eso se maneja donde montes.
      </p>

      <button type="button" onClick={() => setOpen((v) => !v)} className="link-action mt-4">
        {open ? "− Ocultar formulario" : "+ Añadir corte"}
      </button>

      {open && (
        <form
          action={(fd) => {
            createAction(fd);
            setOpen(cuts.length === 0);
          }}
          className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FormField label="Nombre" className="lg:col-span-2">
            <input name="name" required placeholder="Corte 1" className={INPUT} />
          </FormField>
          <FormField label="Fecha">
            <input name="date" type="date" className={INPUT} />
          </FormField>
          <FormField label="Duración">
            <input name="durationLabel" placeholder="12 min" className={INPUT} />
          </FormField>
          <FormField label="Notas" className="sm:col-span-2 lg:col-span-4">
            <input name="notes" placeholder="Qué se dijo al verlo, qué falta ajustar…" className={INPUT} />
          </FormField>
          <div>
            <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-secondary">
              Añadir corte
            </SubmitButton>
          </div>
        </form>
      )}

      {cuts.length === 0 ? (
        <EmptyState title="Todavía no hay cortes registrados" description="Añade el primero con el formulario de arriba." />
      ) : (
        <ul className="mt-6 border-t border-line">
          {cuts.map((cut) => (
            <CutRow key={cut.id} projectId={projectId} cut={cut} />
          ))}
        </ul>
      )}
    </div>
  );
}
