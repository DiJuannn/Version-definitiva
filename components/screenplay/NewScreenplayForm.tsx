"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import type { CreateScreenplayState } from "@/lib/actions/screenplays";

const INPUT =
  "field w-full px-3 py-2 text-sm";

const FORMATS = [
  { value: "SHORT", label: "Cortometraje" },
  { value: "FEATURE", label: "Largometraje" },
  { value: "SERIES_EPISODE", label: "Episodio de serie" },
  { value: "OTHER", label: "Otro" },
];

export function NewScreenplayForm({
  action,
}: {
  action: (prev: CreateScreenplayState, formData: FormData) => Promise<CreateScreenplayState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [mode, setMode] = useState<"blank" | "import">("blank");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex gap-1 border border-line p-1 font-mono text-[11px] tracking-widest uppercase" role="tablist">
        {(
          [
            ["blank", "Empezar en blanco"],
            ["import", "Importar PDF o Fountain"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`flex-1 px-3 py-2 transition-colors ${
              mode === value ? "bg-accent text-bg" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <FormField label="Título">
        <input name="title" required={mode === "blank"} maxLength={120} placeholder="La última toma" className={INPUT} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Formato">
          <select name="format" defaultValue="SHORT" className={`${INPUT} bg-bg`}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Escrito por" hint="Sale en la portada del PDF.">
          <input name="author" maxLength={120} className={INPUT} />
        </FormField>
      </div>

      <FormField label="Logline" hint="La historia en una o dos frases. Opcional.">
        <textarea name="logline" rows={2} maxLength={400} className={`${INPUT} resize-none`} />
      </FormField>

      {mode === "blank" && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">¿Por dónde empiezas?</legend>
          {(
            [
              ["guion", "Directo al guion", "Con lo que tengas, aunque sean ideas sueltas."],
              ["idea", "Por la idea", "Idea, tesis, logline, personajes…"],
            ] as const
          ).map(([value, label, hint], i) => (
            <label key={value} className="flex cursor-pointer items-start gap-3 border border-line px-3 py-2.5 has-[:checked]:border-accent">
              <input type="radio" name="start" value={value} defaultChecked={i === 0} className="mt-1 accent-[var(--accent)]" />
              <span className="text-sm">
                {label}
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
          <span className="font-mono text-[10px] text-muted">Puedes cambiar de paso cuando quieras.</span>
        </fieldset>
      )}

      {mode === "import" && (
        <FormField label="Archivo del guion" hint="PDF (de Final Draft, Celtx, Word, Google Docs…) o Fountain. Si no pones título, se usa el de la portada.">
          <input
            type="file"
            name="file"
            required
            accept=".pdf,application/pdf,.fountain,.spmd,.txt,text/plain"
            className="font-mono text-xs text-muted file:mr-3 file:border file:border-line file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-xs file:text-fg"
          />
        </FormField>
      )}

      {state?.error && (
        <p className="font-mono text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton pendingLabel={mode === "import" ? "Importando…" : "Creando…"} className="btn btn-primary self-start">
        {mode === "import" ? "Importar guion" : "Crear guion"}
      </SubmitButton>
    </form>
  );
}
