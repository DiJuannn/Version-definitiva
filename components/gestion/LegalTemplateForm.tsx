"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LEGAL_TEMPLATES, type LegalTemplateSlug } from "@/lib/pdf/legal/templates";

// Plantillas legales en dos hojas de papel: a la izquierda lo que rellenas
// (campos sobre una raya, como en un impreso) y a la derecha el documento tal
// y como saldrá en el PDF, que se va escribiendo mientras tecleas. El texto
// de la vista previa sale de la misma función que genera el PDF
// (LEGAL_TEMPLATES), así que lo que ves es lo que firmarás.

export const LEGAL_LABEL = "eyebrow";
export const LEGAL_INPUT = "field-line";

export function LegalField({
  label,
  hint,
  wide = false,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block ${wide ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <span className={LEGAL_LABEL}>{label}</span>
      {children}
      {hint && <span className="mt-1 block font-sans text-xs text-muted">{hint}</span>}
    </label>
  );
}

function readFields(form: HTMLFormElement): Record<string, string> {
  const fields: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    if (typeof value === "string") fields[key] = value;
  });
  return fields;
}

// Marca en la vista previa los huecos todavía sin rellenar («—»).
function Prose({ text }: { text: string }) {
  const parts = text.split("—");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="mx-0.5 inline-block min-w-20 rounded-sm border-b border-dotted border-warn bg-warn/10 align-baseline" aria-label="sin rellenar">
              &nbsp;
            </span>
          )}
        </span>
      ))}
    </>
  );
}

export function LegalTemplateForm({
  action,
  slug,
  projectName,
  organizationName,
  warning,
  tip,
  children,
}: {
  action: string;
  slug: LegalTemplateSlug;
  projectName: string;
  organizationName: string;
  warning?: string;
  tip?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const sync = useCallback(() => {
    if (formRef.current) setFields(readFields(formRef.current));
  }, []);
  useEffect(sync, [sync]);

  const content = LEGAL_TEMPLATES[slug].buildContent({
    project: { name: projectName },
    organizationName,
    fields,
  });

  return (
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10">
      {/* ------------------------------------------------ lo que se rellena */}
      <form
        ref={formRef}
        action={action}
        method="POST"
        target="_blank"
        onInput={sync}
        onChange={sync}
        className="paper p-6 sm:p-8 lg:sticky lg:top-24"
      >
        <p className="eyebrow text-accent">Rellena</p>
        <div className="mt-4 grid content-start gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-1 [&_textarea]:w-full">{children}</div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" className="btn btn-primary">
            Generar PDF
          </button>
          <span className="font-sans text-xs text-muted">Se abre en otra pestaña, listo para imprimir y firmar.</span>
        </div>

        <div className="mt-8 space-y-3 border-t border-line pt-5 font-sans text-[13px] leading-relaxed text-muted">
          <p>
            <span className="text-fg">Se rellena solo:</span> «{projectName}», {organizationName || "tu productora"} y la fecha
            de hoy.
          </p>
          {tip && <p>{tip}</p>}
          <p className="border-l-2 border-warn pl-3">
            {warning ?? "Es una plantilla orientativa: no sustituye a una asesoría legal y su validez depende del país."}
          </p>
        </div>
      </form>

      {/* ------------------------------------------------ cómo saldrá */}
      <section aria-labelledby="vista-previa" className="min-w-0">
        <p id="vista-previa" className="eyebrow mb-3">
          Vista previa · así saldrá el PDF
        </p>
        <article
          aria-live="polite"
          className="paper mx-auto max-w-[44rem] px-7 py-10 font-serif text-[15px] leading-[1.7] text-fg sm:px-14 sm:py-16"
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
        >
          <p className="text-center font-sans text-[10px] tracking-[0.12em] text-muted uppercase">{content.letterhead}</p>
          {content.caution && <p className="mt-1 text-center text-[12px] text-muted italic">{content.caution}</p>}
          <h2 className="mt-8 text-center text-xl font-bold tracking-wide uppercase underline underline-offset-4">
            {content.title}
          </h2>
          <div className="mt-8 space-y-4 text-justify hyphens-auto" lang="es">
            {content.paragraphs.map((p, i) => (
              <p key={i}>
                <Prose text={p} />
              </p>
            ))}
          </div>
          <div className="mt-14 grid grid-cols-2 gap-8 sm:gap-14">
            {content.signatures.map((sig) => (
              <div key={sig.role} className="text-[13px]">
                <div className="h-12 border-b border-fg/60" />
                <p className="mt-2 font-bold">{sig.name || " "}</p>
                <p className="text-muted">{sig.role}</p>
                {sig.meta && <p className="text-muted">{sig.meta}</p>}
              </div>
            ))}
          </div>
          <p className="mt-12 border-t border-line pt-4 text-[11px] leading-snug text-muted italic">{content.disclaimer}</p>
        </article>
      </section>
    </div>
  );
}
