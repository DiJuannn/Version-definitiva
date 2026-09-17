"use client";

import { useActionState, useState } from "react";
import { submitBudgetRequest } from "@/lib/actions/budget-request";
import { SubmitButton } from "@/components/SubmitButton";

const PROJECT_TYPES = ["Ficción", "Publicidad", "Documental", "Corporativo", "Otro"];
const SCRIPT_OPTIONS = [
  "Ya tengo guion",
  "Tengo una idea, falta desarrollarla",
  "Hay que crearlo desde cero",
];
const DURATION_OPTIONS = [
  "Menos de 1 minuto",
  "1-3 minutos",
  "3-10 minutos",
  "Más de 10 minutos",
];
const BUDGET_RANGES = [
  "Menos de 3.000€",
  "3.000€ – 10.000€",
  "10.000€ – 30.000€",
  "Más de 30.000€",
  "Aún no lo sé",
];

const fieldClass =
  "border border-line bg-transparent px-3 py-2.5 font-mono text-sm outline-none transition-colors focus:border-accent";
const optionClass =
  "w-full border border-line px-4 py-3 text-left font-mono text-sm transition-colors hover:border-accent hover:text-accent";

type Answers = {
  projectType: string;
  hasScript: string;
  duration: string;
  budgetRange: string;
};

const STEPS: { key: keyof Answers; question: string; options: string[] }[] = [
  { key: "projectType", question: "¿Qué necesitas?", options: PROJECT_TYPES },
  {
    key: "hasScript",
    question: "¿Tienes guion o hay que crearlo desde cero?",
    options: SCRIPT_OPTIONS,
  },
  { key: "duration", question: "¿Duración aproximada?", options: DURATION_OPTIONS },
  {
    key: "budgetRange",
    question: "¿Presupuesto orientativo?",
    options: BUDGET_RANGES,
  },
];

export function BudgetRequestForm() {
  const [state, formAction] = useActionState(submitBudgetRequest, undefined);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    projectType: "",
    hasScript: "",
    duration: "",
    budgetRange: "",
  });

  if (state && "ok" in state) {
    return (
      <div className="border border-line p-8 text-center">
        <p className="font-display text-xl font-bold uppercase">Recibido.</p>
        <p className="mt-2 font-mono text-sm text-muted">
          Te contactamos en 24-48h con un presupuesto ajustado a tu proyecto.
        </p>
      </div>
    );
  }

  const totalSteps = STEPS.length + 1;

  return (
    <div className="border border-line p-6 sm:p-8">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-1 flex-1 ${i <= step ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] tracking-widest text-muted uppercase">
        Paso {step + 1} de {totalSteps}
      </p>

      {step < STEPS.length ? (
        <div className="mt-6">
          <h3 className="font-display text-lg font-bold uppercase">
            {STEPS[step].question}
          </h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {STEPS[step].options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, [STEPS[step].key]: option }));
                  setStep((s) => s + 1);
                }}
                className={optionClass}
              >
                {option}
              </button>
            ))}
          </div>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="mt-5 font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
            >
              ← Atrás
            </button>
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-6 grid gap-4">
          <input type="hidden" name="projectType" value={answers.projectType} />
          <input type="hidden" name="hasScript" value={answers.hasScript} />
          <input type="hidden" name="duration" value={answers.duration} />
          <input type="hidden" name="budgetRange" value={answers.budgetRange} />

          {/* Honeypot anti-spam: oculto para personas, visible para bots */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px]"
          />

          <h3 className="font-display text-lg font-bold uppercase">
            Tus datos
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <input name="name" placeholder="Tu nombre" required className={fieldClass} />
            <input
              type="email"
              name="email"
              placeholder="Tu email"
              required
              className={fieldClass}
            />
          </div>

          <textarea
            name="message"
            placeholder="Cuéntanos un poco más (opcional)"
            rows={3}
            className={fieldClass}
          />

          {state?.error && (
            <p className="font-mono text-xs text-accent">{state.error}</p>
          )}

          <div className="flex items-center gap-4">
            <SubmitButton
              pendingLabel="Enviando…"
              className="w-fit rounded-full bg-fg px-6 py-2.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Enviar
            </SubmitButton>
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
            >
              ← Atrás
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
