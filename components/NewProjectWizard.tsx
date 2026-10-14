"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { createProjectGuided } from "@/lib/actions/projects";
import { PROJECT_STAGES, PROJECT_TYPES, type ProjectStage } from "@/lib/project-types";

const STEPS = 3;

// Pantalla guiada del primer proyecto: nombre → tipo → punto de partida.
// Tipo y punto de partida se pueden saltar; solo el nombre es obligatorio.
export function NewProjectWizard() {
  const [state, formAction] = useActionState(createProjectGuided, undefined);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [stage, setStage] = useState<ProjectStage | "">("");

  const canContinue = step !== 1 || name.trim().length > 0;

  return (
    <form action={formAction} className="text-left">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="stage" value={stage} />

      <div className="mx-auto flex max-w-[9rem] gap-1.5" aria-hidden>
        {Array.from({ length: STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-center font-mono text-[10px] tracking-widest text-muted uppercase">
        Paso {step} de {STEPS}
      </p>

      {step === 1 && (
        <div className="mt-6">
          <label htmlFor="wizard-name" className="block text-center font-display text-xl font-black tracking-tight">
            ¿Cómo se llama tu proyecto?
          </label>
          <input
            id="wizard-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (name.trim()) setStep(2);
              }
            }}
            placeholder="Ej. Noche en el Neón"
            autoFocus
            maxLength={120}
            className="field mt-4 w-full px-3 py-2.5 text-sm"
          />
          <p className="mt-2 text-center font-sans text-xs text-muted">
            Puedes cambiarlo cuando quieras.
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6">
          <p className="text-center font-display text-xl font-black tracking-tight">¿Qué tipo de proyecto es?</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {PROJECT_TYPES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={type === option}
                onClick={() => setType(type === option ? "" : option)}
                className={`rounded-full border px-4 py-2 font-sans text-sm transition-colors ${
                  type === option
                    ? "border-accent bg-accent text-bg"
                    : "border-line text-fg hover:border-accent hover:text-accent"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-6">
          <p className="text-center font-display text-xl font-black tracking-tight">¿En qué punto estás?</p>
          <div className="mt-5 divide-y divide-line border-y border-line">
            {PROJECT_STAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={stage === option.id}
                onClick={() => setStage(stage === option.id ? "" : option.id)}
                className={`flex w-full items-start gap-3 px-2 py-3 text-left transition-colors ${
                  stage === option.id ? "bg-accent/10" : "hover:bg-fg/5"
                }`}
              >
                {/* Opción como fila con su punto de radio, no como cajita con borde. */}
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                    stage === option.id ? "ring-2 ring-accent" : "ring-1 ring-muted/60"
                  }`}
                >
                  {stage === option.id && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-[15px] font-bold">{option.label}</span>
                  <span className="mt-0.5 block font-sans text-[13px] text-muted">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7 flex items-center justify-between gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="link-action"
          >
            ← Atrás
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-4">
          {step > 1 && step < STEPS && (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="link-action"
            >
              Saltar
            </button>
          )}
          {step < STEPS ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
              className="btn btn-primary disabled:opacity-50"
            >
              Continuar
            </button>
          ) : (
            <SubmitButton pendingLabel="Creando…" className="btn btn-primary">
              Crear proyecto
            </SubmitButton>
          )}
        </div>
      </div>

      {state?.error && (
        <p className="mt-4 border-l-2 border-danger pl-3 font-sans text-sm text-danger" role="alert">
          {state.error}
          {state.upgrade && (
            <>
              {" "}
              <Link href="/app/organizacion" className="underline hover:no-underline">
                Ver planes →
              </Link>
            </>
          )}
        </p>
      )}
    </form>
  );
}
