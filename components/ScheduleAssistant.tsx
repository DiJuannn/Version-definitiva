"use client";

import { useState, useTransition } from "react";
import {
  applySchedule,
  previewSchedule,
  type ScheduleParams,
  type ScheduleProposal,
} from "@/lib/actions/schedule-assistant";

const INPUT =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

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
      <p className="max-w-xl font-sans text-sm text-muted">
        Dime cuándo empiezas a rodar y cuántas escenas te caben al día. Te propongo las jornadas juntando las escenas
        de un mismo sitio y ordenándolas por luz. Tú lo revisas: no se crea nada hasta que lo aceptes.
      </p>
      <div className="mt-5 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Primer día de rodaje</span>
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
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">Escenas por día</span>
          <select
            value={perDay}
            onChange={(e) => {
              setPerDay(Number(e.target.value));
              setProposal(null);
            }}
            className={INPUT}
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n} className="bg-bg">
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 font-sans text-sm">
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
        <button type="button" onClick={propose} disabled={pending || applying} className="btn btn-primary disabled:opacity-60">
          {pending ? "Calculando…" : proposal?.ok ? "Recalcular" : "Ver propuesta"}
        </button>
      </div>

      {error && <p role="alert" className="mt-4 font-mono text-xs text-danger">{error}</p>}

      {proposal?.ok && (
        <div className="mt-6">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            Propuesta · {proposal.days.length} día{proposal.days.length === 1 ? "" : "s"} para {proposal.totalScenes} escena
            {proposal.totalScenes === 1 ? "" : "s"}
          </p>
          <ol className="mt-3 border-t border-line">
            {proposal.days.map((day, i) => (
              <li key={day.date} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-3">
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold">
                    Día {i + 1} · {formatDay(day.date)}
                  </p>
                  <p className="font-mono text-xs text-muted">{day.locations.join(" · ")}</p>
                </div>
                <p className="font-mono text-xs">Escenas {day.scenes.map((s) => s.label).join(", ")}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button type="button" onClick={apply} disabled={applying} className="btn btn-primary disabled:opacity-60">
              {applying ? "Creando…" : "Crear este plan"}
            </button>
            <p className="font-sans text-xs text-muted">Después puedes mover escenas entre días en el tablero de abajo.</p>
          </div>
        </div>
      )}
    </div>
  );

  if (!hasDays) {
    return (
      <section aria-labelledby="schedule-assistant" className="mt-8 border border-accent/40 bg-bg-raised/40 p-6 sm:p-8">
        <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Te lo preparo yo</p>
        <h2 id="schedule-assistant" className="mt-1.5 font-display text-2xl font-black tracking-tight sm:text-3xl">
          Crea tu plan de rodaje
        </h2>
        <div className="mt-3">{body}</div>
      </section>
    );
  }

  return (
    <details className="group mt-8 border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent [&::-webkit-details-marker]:hidden">
        <span>
          Repartir con el asistente las {unscheduled} escena{unscheduled === 1 ? "" : "s"} sin día
        </span>
        <span aria-hidden className="transition-transform group-open:rotate-90">→</span>
      </summary>
      <div className="border-t border-line p-5">{body}</div>
    </details>
  );
}
