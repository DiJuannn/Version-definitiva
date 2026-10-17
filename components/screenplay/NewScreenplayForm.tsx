"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import type { CreateScreenplayState } from "@/lib/actions/screenplays";

const INPUT = "field w-full px-3 py-2 text-sm";

const FORMATS = [
  { value: "SHORT", label: "Cortometraje" },
  { value: "FEATURE", label: "Largometraje" },
  { value: "SERIES_EPISODE", label: "Episodio de serie" },
  { value: "OTHER", label: "Otro" },
];

const STARTS = [
  {
    value: "guided",
    title: "Nunca he escrito un guion — guíame",
    text: "Te hago 5 preguntas sencillas y te preparo las escenas para que solo tengas que escribirlas. Unos 3 minutos.",
    badge: "Si es tu primera vez",
  },
  {
    value: "blank",
    title: "Ya sé lo que hago",
    text: "Directo a la página en blanco, con formato profesional.",
  },
] as const;

// «Nuevo guion» en un solo campo: cómo se llama (o nada) y cómo se quiere
// empezar. Lo demás (formato, autoría, logline) es opcional y va plegado.
export function NewScreenplayForm({
  action,
}: {
  action: (prev: CreateScreenplayState, formData: FormData) => Promise<CreateScreenplayState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [importing, setImporting] = useState(false);
  const [start, setStart] = useState<"guided" | "blank">("guided");

  if (importing) {
    return (
      <form action={formAction} className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted">
          Sube el guion que ya tienes y sigue escribiéndolo aquí. Se respetan las escenas, los personajes y los diálogos.
        </p>
        <FormField label="Archivo del guion" hint="PDF (de Final Draft, Celtx, Word, Google Docs…) o Fountain, un formato de texto que usan las apps de guion.">
          <input
            type="file"
            name="file"
            required
            accept=".pdf,application/pdf,.fountain,.spmd,.txt,text/plain"
            className="font-mono text-xs text-muted file:mr-3 file:border file:border-line file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-xs file:text-fg"
          />
        </FormField>
        <FormField label="Título (opcional)" hint="Si lo dejas vacío, se usa el de la portada.">
          <input name="title" maxLength={120} className={INPUT} />
        </FormField>
        {state?.error && (
          <p className="font-mono text-xs text-danger" role="alert">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton pendingLabel="Importando…" className="btn btn-primary">
            Importar guion
          </SubmitButton>
          <button type="button" onClick={() => setImporting(false)} className="text-sm text-muted hover:text-fg">
            ← Empezar uno nuevo
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold text-fg">
          ¿Cómo se llama? <span className="font-normal text-muted">(puedes cambiarlo luego)</span>
        </span>
        <input name="title" maxLength={120} placeholder="La bicicleta roja" autoComplete="off" className={`${INPUT} py-2.5 text-base`} />
      </label>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-[15px] font-semibold text-fg">¿Cómo quieres empezar?</legend>
        {STARTS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[var(--r-md)] border px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
              start === o.value ? "border-accent bg-accent/[0.07]" : "border-line hover:border-fg/30"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={o.value}
              checked={start === o.value}
              onChange={() => setStart(o.value)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-fg">
                {o.title}
                {"badge" in o && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">{o.badge}</span>
                )}
              </span>
              <span className="mt-1 block text-[13px] leading-snug text-muted">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <details className="group rounded-[var(--r-sm)] text-sm">
        <summary className="cursor-pointer list-none text-muted hover:text-fg">
          <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-90">▸</span>
          Más opciones <span className="text-muted">(formato, quién lo escribe, la historia en una frase)</span>
        </summary>
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="¿Qué vas a escribir?">
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
          <FormField label="Tu historia en una frase (logline)" hint="Quién, qué quiere y qué se lo impide. Si eliges «guíame», la montamos juntos.">
            <textarea name="logline" rows={2} maxLength={400} className={`${INPUT} resize-none`} />
          </FormField>
        </div>
      </details>

      {state?.error && (
        <p className="font-mono text-xs text-danger" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" onClick={() => setImporting(true)} className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
          ¿Ya lo tienes escrito? Importar PDF o Fountain
        </button>
        <SubmitButton pendingLabel="Creando…" className="btn btn-primary">
          {start === "guided" ? "Empezar con las preguntas →" : "Ir a la página en blanco →"}
        </SubmitButton>
      </div>
    </form>
  );
}
