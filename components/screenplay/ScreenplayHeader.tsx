"use client";

import { useActionState, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { Modal } from "@/components/Modal";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { DangerConfirmButton } from "@/components/DangerConfirmButton";
import {
  deleteScreenplay,
  updateScreenplayDetails,
  type ScreenplayDetailsState,
} from "@/lib/actions/screenplays";

const INPUT =
  "w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

const FORMATS = [
  { value: "SHORT", label: "Cortometraje" },
  { value: "FEATURE", label: "Largometraje" },
  { value: "SERIES_EPISODE", label: "Episodio de serie" },
  { value: "OTHER", label: "Otro" },
];

// El editor guarda antes de exportar (ver ScreenplayEditor): así el PDF o el
// Fountain llevan siempre lo último que se ha escrito.
function exportTo(href: string) {
  window.dispatchEvent(new CustomEvent("screenplay:export", { detail: href }));
}

export function ScreenplayHeader({
  id,
  title,
  format,
  formatLabel,
  logline,
  author,
}: {
  id: string;
  title: string;
  format: string;
  formatLabel: string;
  logline: string | null;
  author: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pdfSize, setPdfSize] = useState<"A4" | "LETTER">("A4");
  const [state, formAction] = useActionState<ScreenplayDetailsState, FormData>(async (prev, formData) => {
    const result = await updateScreenplayDetails(id, prev, formData);
    if (result?.ok) setOpen(false);
    return result;
  }, undefined);

  return (
    <header>
      <BackLink href="/app/guiones">← Guiones</BackLink>
      <p className="mt-5 font-mono text-[11px] tracking-widest text-accent uppercase">
        {formatLabel}
        {author ? ` · ${author}` : ""}
      </p>
      <h1 className="mt-1.5 font-display text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">{title}</h1>
      {logline && <p className="mt-3 max-w-2xl font-sans text-sm text-muted">{logline}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline">
          Ajustes
        </button>
        <span className="flex items-center border border-line">
          <button type="button" onClick={() => exportTo(`/api/pdf/guion/${id}?size=${pdfSize}`)} className="btn border-0">
            Exportar PDF
          </button>
          <label className="sr-only" htmlFor="sp-pdf-size">
            Tamaño de página
          </label>
          <select
            id="sp-pdf-size"
            value={pdfSize}
            onChange={(e) => setPdfSize(e.target.value === "LETTER" ? "LETTER" : "A4")}
            className="h-full border-l border-line bg-bg px-2 py-2 font-mono text-[11px] text-muted outline-none"
          >
            <option value="A4">A4</option>
            <option value="LETTER">Carta</option>
          </select>
        </span>
        <button type="button" onClick={() => exportTo(`/api/guiones/${id}/fountain`)} className="btn btn-outline">
          Fountain
        </button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajustes del guion">
        <form action={formAction} className="mt-5 flex flex-col gap-4">
          <FormField label="Título">
            <input name="title" defaultValue={title} required maxLength={120} className={INPUT} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Formato">
              <select name="format" defaultValue={format} className={`${INPUT} bg-bg`}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Escrito por">
              <input name="author" defaultValue={author ?? ""} maxLength={120} className={INPUT} />
            </FormField>
          </div>
          <FormField label="Logline">
            <textarea name="logline" defaultValue={logline ?? ""} rows={3} maxLength={400} className={`${INPUT} resize-none`} />
          </FormField>
          {state?.error && (
            <p className="font-mono text-xs text-danger" role="alert">
              {state.error}
            </p>
          )}
          <div className="flex items-center justify-between gap-4">
            <DangerConfirmButton
              trigger="Eliminar guion"
              title="¿Eliminar este guion?"
              description="Se borra el guion entero para todo el equipo. No se puede deshacer: exporta antes un Fountain si quieres guardar una copia."
              action={deleteScreenplay.bind(null, id)}
            />
            <SubmitButton pendingLabel="Guardando…" className="btn btn-primary">
              Guardar
            </SubmitButton>
          </div>
        </form>
      </Modal>
    </header>
  );
}
