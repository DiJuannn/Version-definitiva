"use client";

import { useState } from "react";
import {
  createFestivalSubmission,
  deleteFestivalSubmission,
  updateFestivalSubmissionStatus,
} from "@/lib/actions/festival-submissions";
import { FESTIVAL_SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { Modal } from "@/components/Modal";

export type FestivalSubmissionView = {
  id: string;
  festivalName: string;
  deadline: string | null;
  submittedAt: string | null;
  fee: number | null;
  status: string;
  url: string | null;
  notes: string | null;
};

const INPUT = "field w-full";

// Color del punto de estado de cada envío.
const STATUS_DOT: Record<string, string> = {
  PLANNED: "bg-muted",
  SUBMITTED: "bg-accent",
  IN_REVIEW: "bg-accent",
  SELECTED: "bg-success",
  REJECTED: "bg-danger",
  WITHDRAWN: "bg-line",
};

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function daysUntil(iso: string): number {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

function Row({ projectId, submission }: { projectId: string; submission: FestivalSubmissionView }) {
  const deadlineDays = submission.deadline ? daysUntil(submission.deadline) : null;
  const urgent = deadlineDays !== null && deadlineDays >= 0 && deadlineDays <= 14 && submission.status === "PLANNED";
  const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  return (
    <li className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3 gap-y-3 py-4 sm:grid-cols-[0.75rem_minmax(0,1fr)_11rem_auto] sm:items-center sm:gap-x-5">
      <span aria-hidden className={`mt-2 h-2 w-2 self-start rounded-full sm:mt-0 sm:self-center ${STATUS_DOT[submission.status] ?? "bg-muted"}`} />
      <div className="min-w-0">
        <p className="font-sans text-[15px] font-medium">
          {submission.url ? (
            <a href={submission.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {submission.festivalName} <span aria-hidden className="text-muted">↗</span>
            </a>
          ) : (
            submission.festivalName
          )}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {submission.deadline ? (
            <span className={urgent ? "font-medium text-warn" : ""}>
              Plazo {dateLabel(submission.deadline)}
              {deadlineDays !== null && deadlineDays >= 0 && submission.status === "PLANNED"
                ? deadlineDays === 0
                  ? " · ¡hoy!"
                  : ` · quedan ${deadlineDays} día${deadlineDays === 1 ? "" : "s"}`
                : ""}
            </span>
          ) : (
            "Sin plazo apuntado"
          )}
          {submission.fee !== null ? ` · ${submission.fee === 0 ? "gratis" : currency(submission.fee)}` : ""}
        </p>
        {submission.notes && <p className="mt-1 max-w-xl font-sans text-sm text-muted">{submission.notes}</p>}
      </div>
      <form
        action={updateFestivalSubmissionStatus.bind(null, projectId, submission.id)}
        className="col-start-2 sm:col-start-auto"
      >
        <label className="sr-only" htmlFor={`status-${submission.id}`}>
          Estado del envío a {submission.festivalName}
        </label>
        <select
          id={`status-${submission.id}`}
          name="status"
          defaultValue={submission.status}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="field w-full py-1.5 text-sm"
        >
          {Object.entries(FESTIVAL_SUBMISSION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value} className="bg-bg">
              {label}
            </option>
          ))}
        </select>
      </form>
      <form
        action={deleteFestivalSubmission.bind(null, projectId, submission.id)}
        className="col-start-2 -mt-2 sm:col-start-auto sm:mt-0"
      >
        <DeleteButton confirmMessage="¿Quitar este envío del seguimiento?" className="link-action">
          Quitar
        </DeleteButton>
      </form>
    </li>
  );
}

// Seguimiento de envíos: a diferencia de la guía de más abajo (que se mira y ya está), esto es lo
// que se consulta varias veces — a qué festivales le has enviado el proyecto, con qué plazo y en
// qué punto está cada uno. Apuntar un envío se hace en un diálogo; si aún no hay ninguno, el
// formulario se ve directamente.
export function FestivalSubmissionsPanel({
  projectId,
  submissions,
}: {
  projectId: string;
  submissions: FestivalSubmissionView[];
}) {
  const [open, setOpen] = useState(false);
  const empty = submissions.length === 0;
  const pending = submissions.filter((s) => s.deadline && daysUntil(s.deadline) >= 0 && daysUntil(s.deadline) <= 14 && s.status === "PLANNED");
  const count = (status: string) => submissions.filter((s) => s.status === status).length;
  const summary = [
    [count("PLANNED"), "por enviar"],
    [count("SUBMITTED") + count("IN_REVIEW"), "esperando respuesta"],
    [count("SELECTED"), count("SELECTED") === 1 ? "seleccionado" : "seleccionados"],
  ].filter(([n]) => (n as number) > 0) as [number, string][];

  const form = (inModal: boolean) => (
    <form
      action={(fd) => {
        createFestivalSubmission(projectId, fd);
        setOpen(false);
      }}
      className={inModal ? "mt-5 space-y-4" : "grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4"}
    >
      <FormField label="Festival" className="sm:col-span-2">
        <input name="festivalName" required placeholder="Nombre del festival" className={INPUT} />
      </FormField>
      <div className={inModal ? "grid grid-cols-2 gap-4" : "contents"}>
        <FormField label="Plazo de inscripción">
          <input name="deadline" type="date" className={INPUT} />
        </FormField>
        <FormField label="Precio (€)">
          <input name="fee" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
        </FormField>
      </div>
      <FormField label="Enlace a la convocatoria" className="sm:col-span-2">
        <input name="url" type="url" placeholder="https://…" className={INPUT} />
      </FormField>
      <FormField label="Notas" className="sm:col-span-2">
        <input name="notes" placeholder="Categoría, contacto, lo que piden…" className={INPUT} />
      </FormField>
      <div className={`flex items-center justify-end gap-4 ${inModal ? "pt-2" : "sm:col-span-2 lg:col-span-4"}`}>
        {inModal && (
          <button type="button" onClick={() => setOpen(false)} className="link-action">
            Cancelar
          </button>
        )}
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
          Apuntar envío
        </SubmitButton>
      </div>
    </form>
  );

  return (
    <section aria-labelledby="envios-title" className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="envios-title" className="font-display text-2xl font-black tracking-tight">
            Tus envíos
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">
            {empty
              ? "Apunta cada festival al que mandes el proyecto y no perderás de vista los plazos."
              : summary.map(([n, label]) => `${n} ${label}`).join(" · ") || `${submissions.length} apuntados`}
          </p>
        </div>
        {!empty && (
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
            + Apuntar un envío
          </button>
        )}
      </div>

      {pending.length > 0 && (
        <p role="status" className="mt-5 border-l-2 border-warn pl-3 font-sans text-sm text-fg">
          {pending.length === 1
            ? `El plazo de «${pending[0].festivalName}» se acaba en menos de dos semanas y aún no lo has enviado.`
            : `${pending.length} plazos se acaban en menos de dos semanas y aún no has enviado esos festivales.`}
        </p>
      )}

      {empty ? (
        <div className="sheet mt-6 p-6 sm:p-8">{form(false)}</div>
      ) : (
        <ul className="sheet mt-6 divide-y divide-line px-5 sm:px-6">
          {submissions.map((s) => (
            <Row key={s.id} projectId={projectId} submission={s} />
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Apuntar un envío"
        description="Solo el nombre es obligatorio. Con el plazo te avisaré cuando quede poco."
      >
        {form(true)}
      </Modal>
    </section>
  );
}
