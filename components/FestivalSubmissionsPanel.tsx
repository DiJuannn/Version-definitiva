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

const INPUT =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

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

  return (
    <li className="border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-base font-bold">
            {submission.url ? (
              <a href={submission.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                {submission.festivalName} ↗
              </a>
            ) : (
              submission.festivalName
            )}
          </p>
          <p className="font-mono text-xs text-muted">
            {submission.deadline && (
              <span className={urgent ? "text-warn" : ""}>
                Plazo: {new Date(submission.deadline).toLocaleDateString("es-ES")}
                {deadlineDays !== null && deadlineDays >= 0 ? ` (en ${deadlineDays} días)` : ""}
              </span>
            )}
            {submission.fee !== null ? ` · ${currency(submission.fee)}` : ""}
          </p>
          {submission.notes && <p className="mt-1 max-w-xl font-sans text-sm text-muted">{submission.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <form action={updateFestivalSubmissionStatus.bind(null, projectId, submission.id)}>
            <select
              name="status"
              defaultValue={submission.status}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="border border-line bg-transparent px-2 py-1.5 font-mono text-[11px] uppercase outline-none focus:border-accent"
            >
              {Object.entries(FESTIVAL_SUBMISSION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-bg">
                  {label}
                </option>
              ))}
            </select>
          </form>
          <form action={deleteFestivalSubmission.bind(null, projectId, submission.id)}>
            <DeleteButton confirmMessage="¿Quitar este envío del seguimiento?" className="link-action" />
          </form>
        </div>
      </div>
    </li>
  );
}

// Seguimiento de envíos: a diferencia de la guía de más abajo (que se mira y ya está), esto es lo
// que se consulta varias veces — a qué festivales le has enviado el proyecto, con qué plazo y en
// qué punto está cada uno.
export function FestivalSubmissionsPanel({
  projectId,
  submissions,
}: {
  projectId: string;
  submissions: FestivalSubmissionView[];
}) {
  const [open, setOpen] = useState(submissions.length === 0);
  const pending = submissions.filter((s) => s.deadline && daysUntil(s.deadline) >= 0 && daysUntil(s.deadline) <= 14 && s.status === "PLANNED");

  return (
    <section className="mt-8 border border-line p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Tu seguimiento</p>
          <h2 className="mt-1 font-display text-xl font-black">Envíos a festivales</h2>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="link-action">
          {open ? "− Ocultar formulario" : "+ Apuntar un envío"}
        </button>
      </div>

      {pending.length > 0 && (
        <p className="mt-3 border border-warn/60 bg-warn/10 px-3 py-2 font-mono text-xs text-warn">
          {pending.length === 1
            ? `El plazo de «${pending[0].festivalName}» se acaba pronto.`
            : `${pending.length} plazos se acaban en menos de dos semanas.`}
        </p>
      )}

      {open && (
        <form
          action={(fd) => {
            createFestivalSubmission(projectId, fd);
            setOpen(submissions.length === 0);
          }}
          className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FormField label="Festival" className="lg:col-span-2">
            <input name="festivalName" required placeholder="Nombre del festival" className={INPUT} />
          </FormField>
          <FormField label="Plazo de inscripción">
            <input name="deadline" type="date" className={INPUT} />
          </FormField>
          <FormField label="Precio de inscripción">
            <input name="fee" type="number" step="0.01" min="0" placeholder="0" className={INPUT} />
          </FormField>
          <FormField label="Enlace" className="sm:col-span-2 lg:col-span-2">
            <input name="url" type="url" placeholder="https://…" className={INPUT} />
          </FormField>
          <FormField label="Notas" className="sm:col-span-2">
            <input name="notes" placeholder="Categoría, contacto, lo que sea" className={INPUT} />
          </FormField>
          <div>
            <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-secondary">
              Añadir
            </SubmitButton>
          </div>
        </form>
      )}

      {submissions.length === 0 ? (
        <p className="mt-4 font-sans text-sm text-muted">
          Todavía no has apuntado ningún envío. En cuanto mandes el proyecto a algún festival, apúntalo aquí para no
          perder de vista los plazos.
        </p>
      ) : (
        <ul className="mt-4 border-t border-line">
          {submissions.map((s) => (
            <Row key={s.id} projectId={projectId} submission={s} />
          ))}
        </ul>
      )}
    </section>
  );
}
