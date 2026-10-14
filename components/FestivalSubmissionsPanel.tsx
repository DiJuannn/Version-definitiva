"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import { PageHeader } from "@/components/PageHeader";

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

// La guía de festivales (más abajo en la página) pide abrir este diálogo con
// el festival ya escrito: se comunican con este evento.
export const PREFILL_EVENT = "taller-festival-prefill";
export type FestivalPrefill = { festivalName: string; url: string };

const INPUT = "field w-full";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function daysUntil(iso: string): number {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

type Tone = "urgent" | "late" | "waiting" | "selected" | "rejected" | "quiet";

// Qué significa cada envío hoy, en una palabra de color y una frase.
function reading(s: FestivalSubmissionView): { tone: Tone; when: string } {
  const d = s.deadline ? daysUntil(s.deadline) : null;
  const plural = (n: number) => `${n} día${n === 1 ? "" : "s"}`;
  if (s.status === "PLANNED") {
    if (d === null) return { tone: "quiet", when: "Sin plazo apuntado" };
    if (d < 0) return { tone: "late", when: `El plazo cerró hace ${plural(-d)} sin enviarlo` };
    if (d === 0) return { tone: "urgent", when: "El plazo se acaba hoy" };
    if (d <= 14) return { tone: "urgent", when: `Quedan ${plural(d)} para enviarlo` };
    return { tone: "quiet", when: `Quedan ${plural(d)}` };
  }
  if (s.status === "SUBMITTED" || s.status === "IN_REVIEW") return { tone: "waiting", when: "Esperando respuesta" };
  if (s.status === "SELECTED") return { tone: "selected", when: "¡Seleccionado!" };
  if (s.status === "REJECTED") return { tone: "rejected", when: "No ha entrado" };
  return { tone: "quiet", when: "Retirado" };
}

const TONE_DOT: Record<Tone, string> = {
  urgent: "bg-warn ring-warn/25",
  late: "bg-danger ring-danger/25",
  waiting: "bg-accent ring-accent/25",
  selected: "bg-success ring-success/25",
  rejected: "bg-danger/70 ring-transparent",
  quiet: "bg-muted ring-transparent",
};
const TONE_TEXT: Record<Tone, string> = {
  urgent: "text-warn",
  late: "text-danger",
  waiting: "text-accent",
  selected: "text-success",
  rejected: "text-muted",
  quiet: "text-muted",
};

function DateBlock({ iso }: { iso: string | null }) {
  if (!iso) {
    return <span className="font-mono text-[11px] tracking-widest text-muted uppercase">Sin fecha</span>;
  }
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return (
    <time dateTime={iso.slice(0, 10)} className="block text-right leading-none">
      <span className="block font-display text-2xl font-black tabular-nums">{d.getDate()}</span>
      <span className="mt-1 block font-mono text-[10px] tracking-widest text-muted uppercase">
        {d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")} {d.getFullYear()}
      </span>
    </time>
  );
}

function Entry({ projectId, submission, past }: { projectId: string; submission: FestivalSubmissionView; past: boolean }) {
  const { tone, when } = reading(submission);
  return (
    <li className="relative grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)] gap-x-3 pb-9 sm:grid-cols-[4.5rem_2rem_minmax(0,1fr)] sm:gap-x-4">
      <div className={`pt-0.5 ${past ? "opacity-60" : ""}`}>
        <DateBlock iso={submission.deadline} />
      </div>
      <div className="flex justify-center pt-2">
        <span aria-hidden className={`relative z-10 h-3 w-3 rounded-full ring-4 ${TONE_DOT[tone]}`} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className={`font-display text-lg leading-tight font-bold tracking-tight ${past && tone !== "late" ? "text-fg/70" : ""}`}>
              {submission.url ? (
                <a href={submission.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                  {submission.festivalName} <span aria-hidden className="font-sans text-sm text-muted">↗</span>
                  <span className="sr-only"> (convocatoria, se abre en otra pestaña)</span>
                </a>
              ) : (
                submission.festivalName
              )}
            </p>
            <p className="mt-1 font-sans text-sm">
              <span className={`font-medium ${TONE_TEXT[tone]}`}>{when}</span>
              {submission.fee !== null && (
                <span className="text-muted"> · {submission.fee === 0 ? "gratis" : currency(submission.fee)}</span>
              )}
            </p>
            {submission.notes && <p className="mt-1 max-w-xl font-sans text-sm leading-relaxed text-muted">{submission.notes}</p>}
          </div>
          <div className="flex items-center gap-4">
            <form action={updateFestivalSubmissionStatus.bind(null, projectId, submission.id)}>
              <label className="sr-only" htmlFor={`status-${submission.id}`}>
                Estado del envío a {submission.festivalName}
              </label>
              <select
                id={`status-${submission.id}`}
                name="status"
                defaultValue={submission.status}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="field w-40 py-1.5 text-sm"
              >
                {Object.entries(FESTIVAL_SUBMISSION_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="bg-bg">
                    {label}
                  </option>
                ))}
              </select>
            </form>
            <form action={deleteFestivalSubmission.bind(null, projectId, submission.id)}>
              <DeleteButton confirmMessage="¿Quitar este envío del seguimiento?" className="link-action">
                Quitar
              </DeleteButton>
            </form>
          </div>
        </div>
      </div>
    </li>
  );
}

function TodayMark() {
  const today = new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
  return (
    <li aria-label={`Hoy, ${today}`} className="relative grid grid-cols-[3.25rem_1.5rem_minmax(0,1fr)] items-center gap-x-3 pb-9 sm:grid-cols-[4.5rem_2rem_minmax(0,1fr)] sm:gap-x-4">
      <span className="text-right font-mono text-[11px] font-semibold tracking-widest text-accent uppercase">Hoy</span>
      <span className="flex justify-center">
        <span aria-hidden className="relative z-10 h-2 w-5 rounded-full bg-accent" />
      </span>
      <span className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-accent/50" />
        <span className="font-mono text-[11px] text-accent">{today}</span>
      </span>
    </li>
  );
}

// Tus envíos como una línea de plazos: cada festival en su fecha límite, con
// un «hoy» que separa lo que ya pasó de lo que viene, y el color del punto
// diciendo en qué está (ámbar: plazo cerca sin enviar; morado: esperando
// respuesta; verde: seleccionado; rojo: plazo perdido o rechazado).
export function FestivalSubmissionsPanel({
  projectId,
  submissions,
  title,
  description,
}: {
  projectId: string;
  submissions: FestivalSubmissionView[];
  title: string;
  description: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<FestivalPrefill | null>(null);
  const empty = submissions.length === 0;

  useEffect(() => {
    function onPrefill(e: Event) {
      setPrefill((e as CustomEvent<FestivalPrefill>).detail);
      setOpen(true);
    }
    window.addEventListener(PREFILL_EVENT, onPrefill);
    return () => window.removeEventListener(PREFILL_EVENT, onPrefill);
  }, []);

  function openNew() {
    setPrefill(null);
    setOpen(true);
  }

  const dated = submissions
    .filter((s) => s.deadline)
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string));
  const undated = submissions.filter((s) => !s.deadline);
  const past = dated.filter((s) => daysUntil(s.deadline as string) < 0);
  const upcoming = dated.filter((s) => daysUntil(s.deadline as string) >= 0);

  const count = (...statuses: string[]) => submissions.filter((s) => statuses.includes(s.status)).length;
  const summary = [
    [count("PLANNED"), "por enviar"],
    [count("SUBMITTED", "IN_REVIEW"), "esperando respuesta"],
    [count("SELECTED"), count("SELECTED") === 1 ? "seleccionado" : "seleccionados"],
    [count("REJECTED"), count("REJECTED") === 1 ? "rechazado" : "rechazados"],
  ].filter(([n]) => (n as number) > 0) as [number, string][];
  const nextUp = upcoming.find((s) => s.status === "PLANNED");
  const urgent = upcoming.filter((s) => s.status === "PLANNED" && daysUntil(s.deadline as string) <= 14);
  const missed = past.filter((s) => s.status === "PLANNED");

  const form = (inModal: boolean) => (
    <form
      key={prefill?.festivalName ?? "nuevo"}
      action={(fd) => {
        createFestivalSubmission(projectId, fd);
        setOpen(false);
      }}
      className={inModal ? "mt-5 space-y-4" : "grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4"}
    >
      <FormField label="Festival" className="sm:col-span-2">
        <input name="festivalName" required placeholder="Nombre del festival" defaultValue={prefill?.festivalName} className={INPUT} />
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
        <input name="url" type="url" placeholder="https://…" defaultValue={prefill?.url} className={INPUT} />
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
    <>
      <PageHeader
        eyebrow="Entrega"
        title={title}
        description={description}
        actions={
          !empty && (
            <button type="button" onClick={openNew} className="btn btn-primary">
              + Apuntar un envío
            </button>
          )
        }
      />

      <section aria-labelledby="envios-title" className="mt-10">
        <h2 id="envios-title" className="font-display text-xl font-black tracking-tight sm:text-2xl">
          Tus plazos
        </h2>

        {empty ? (
          <>
            <p className="mt-1 max-w-2xl font-sans text-sm text-muted">
              Apunta cada festival al que vayas a mandar el proyecto, con su fecha límite, y aquí verás tus plazos en orden con
              los días que quedan.
            </p>
            <div className="sheet mt-6 p-6 sm:p-8">{form(false)}</div>
          </>
        ) : (
          <>
            <p role="status" className="mt-2 flex items-start gap-3 font-sans text-[15px] leading-relaxed">
              <span
                aria-hidden
                className={`mt-[0.55rem] h-2 w-2 shrink-0 rounded-full ${missed.length > 0 ? "bg-danger" : urgent.length > 0 ? "bg-warn" : "bg-success"}`}
              />
              <span>
                {summary.map(([n, label]) => `${n} ${label}`).join(" · ")}.{" "}
                {nextUp ? (
                  <>
                    Próximo plazo: <strong className="font-semibold">{nextUp.festivalName}</strong>,{" "}
                    {daysUntil(nextUp.deadline as string) === 0
                      ? "hoy"
                      : `en ${daysUntil(nextUp.deadline as string)} día${daysUntil(nextUp.deadline as string) === 1 ? "" : "s"}`}
                    .
                  </>
                ) : (
                  "No tienes plazos abiertos por enviar."
                )}
              </span>
            </p>
            {(urgent.length > 0 || missed.length > 0) && (
              <div className="mt-3 space-y-2">
                {urgent.map((s) => (
                  <p key={s.id} className="border-l-2 border-warn pl-3 font-sans text-sm text-fg">
                    «{s.festivalName}» cierra en {daysUntil(s.deadline as string)} días y aún no lo has enviado.
                  </p>
                ))}
                {missed.map((s) => (
                  <p key={s.id} className="border-l-2 border-danger pl-3 font-sans text-sm text-fg">
                    Se pasó el plazo de «{s.festivalName}» sin enviarlo: cámbialo a «Retirado» o quítalo.
                  </p>
                ))}
              </div>
            )}

            <ol className="relative mt-10 before:absolute before:top-2 before:bottom-10 before:left-[calc(3.25rem+0.75rem+0.75rem-1px)] before:w-0.5 before:bg-line sm:before:left-[calc(4.5rem+1rem+1rem-1px)]">
              {past.map((s) => (
                <Entry key={s.id} projectId={projectId} submission={s} past />
              ))}
              <TodayMark />
              {upcoming.map((s) => (
                <Entry key={s.id} projectId={projectId} submission={s} past={false} />
              ))}
              {undated.map((s) => (
                <Entry key={s.id} projectId={projectId} submission={s} past={false} />
              ))}
            </ol>
          </>
        )}
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={prefill ? `Apuntar ${prefill.festivalName}` : "Apuntar un envío"}
        description="Solo el nombre es obligatorio. Con el plazo te avisaré cuando quede poco."
      >
        {form(true)}
      </Modal>
    </>
  );
}
