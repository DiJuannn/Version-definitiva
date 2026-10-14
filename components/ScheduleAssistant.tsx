"use client";

import { useState, useTransition } from "react";
import {
  applySchedule,
  previewSchedule,
  type ScheduleParams,
  type ScheduleProposal,
} from "@/lib/actions/schedule-assistant";

const INPUT = "field";
const LABEL = "eyebrow";

function formatDay(key: string) {
  const text = new Date(`${key}T00:00:00Z`).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Asistente de plan de rodaje: dices cuándo empiezas y cuántas escenas te caben al día; propone
// las jornadas (localizaciones juntas, por luz) y, si te gusta, las crea. Nada se guarda antes.
export function ScheduleAssistant({
  projectId,
  unscheduled,
  hasDays,
}: {
  projectId: string;
  unscheduled: number;
  hasDays: boolean;
}) {
  const [startDate, setStartDate] = useState("");
  const [perDay, setPerDay] = useState(3);
  const [weekendsOnly, setWeekendsOnly] = useState(false);
  const [proposal, setProposal] = useState<ScheduleProposal | null>(null);
  const [pending, startTransition] = useTransition();
  const [applying, startApply] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const params: ScheduleParams = { startDate, perDay, weekendsOnly };

  function propose() {
    setError(null);
    if (!startDate) {
      setProposal(null);
      setError("Elige la fecha en la que quieres empezar a rodar.");
      return;
    }
    startTransition(async () => {
      const result = await previewSchedule(projectId, params);
      if (!result.ok) {
        setProposal(null);
        setError(result.error);
        return;
      }
      setProposal(result);
    });
  }

  function apply() {
    setError(null);
    startApply(async () => {
      const result = await applySchedule(projectId, params);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // El tablero de abajo guarda su propio estado: se recarga para que enseñe el plan nuevo.
      window.location.reload();
    });
  }

  const body = (
    <div>
      <p className="max-w-xl font-sans text-[15px] leading-relaxed text-muted">
        Dime cuándo empiezas a rodar y cuántas escenas te caben al día. Te
        propongo las jornadas juntando las escenas de un mismo sitio y
        ordenándolas por luz. Tú lo revisas: no se crea nada hasta que lo
        aceptes.
      </p>
      <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-4">
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Primer día de rodaje</span>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setProposal(null);
            }}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={LABEL}>Escenas por día</span>
          <select
            value={perDay}
            onChange={(e) => {
              setPerDay(Number(e.target.value));
              setProposal(null);
            }}
            className={INPUT}
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex h-[38px] items-center gap-2 font-sans text-sm">
          <input
            type="checkbox"
            checked={weekendsOnly}
            onChange={(e) => {
              setWeekendsOnly(e.target.checked);
              setProposal(null);
            }}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          Solo sábados y domingos
        </label>
        <button
          type="button"
          onClick={propose}
          disabled={pending || applying}
          className={`btn ${proposal?.ok ? "btn-outline" : "btn-primary"}`}
        >
          {pending
            ? "Calculando…"
            : proposal?.ok
              ? "Recalcular"
              : "Ver propuesta"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-5 border-l-2 border-danger pl-3 font-sans text-sm text-danger"
        >
          {error}
        </p>
      )}

      {proposal?.ok && (
        <div className="mt-8">
          <p className="eyebrow text-accent">
            Propuesta · {proposal.days.length} día
            {proposal.days.length === 1 ? "" : "s"} para {proposal.totalScenes}{" "}
            escena
            {proposal.totalScenes === 1 ? "" : "s"}
          </p>
          <ol className="mt-3 border-t border-line">
            {proposal.days.map((day, i) => (
              <li
                key={day.date}
                className="grid grid-cols-[3.5rem_1fr] items-baseline gap-x-4 gap-y-1 border-b border-line py-3 sm:grid-cols-[3.5rem_1fr_auto]"
              >
                <span className="eyebrow">Día {i + 1}</span>
                <div className="min-w-0">
                  <p className="font-display text-base font-bold">
                    {formatDay(day.date)}
                  </p>
                  {day.locations.length > 0 && (
                    <p className="font-sans text-sm text-muted">
                      {day.locations.join(" · ")}
                    </p>
                  )}
                </div>
                <p className="col-start-2 font-mono text-xs sm:col-start-auto">
                  Escenas {day.scenes.map((s) => s.label).join(", ")}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={apply}
              disabled={applying}
              className="btn btn-primary"
            >
              {applying ? "Creando…" : "Crear este plan"}
            </button>
            <p className="font-sans text-sm text-muted">
              Después puedes mover escenas entre días en el tablero.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Sin días todavía: el asistente es el primer paso, a la vista y en papel.
  if (!hasDays) {
    return (
      <section
        aria-labelledby="schedule-assistant"
        className="sheet mt-10 p-6 sm:p-10"
      >
        <p className="eyebrow text-accent">Te lo preparo yo</p>
        <h2
          id="schedule-assistant"
          className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl"
        >
          Crea tu plan de rodaje
        </h2>
        <div className="mt-3">{body}</div>
      </section>
    );
  }

  // Con días: una línea de aviso que se despliega en una hoja.
  return (
    <details className="group mt-10">
      <summary className="flex cursor-pointer list-none items-center gap-3 border-l-2 border-accent py-1 pl-4 font-sans text-[15px] hover:text-accent [&::-webkit-details-marker]:hidden">
        <span>
          {unscheduled === 1 ? "Queda " : "Quedan "}
          <strong className="font-semibold">
            {unscheduled} escena{unscheduled === 1 ? "" : "s"} sin día
          </strong>
          .{" "}
          <span className="text-accent">
            {unscheduled === 1 ? "¿Te la reparto?" : "¿Te las reparto?"}
          </span>
        </span>
        <span
          aria-hidden
          className="text-accent transition-transform group-open:rotate-90"
        >
          →
        </span>
      </summary>
      <div className="sheet mt-4 p-6 sm:p-8">{body}</div>
    </details>
  );
}
