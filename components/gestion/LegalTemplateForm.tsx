import type { ReactNode } from "react";

// Hoja común de las plantillas legales: el formulario parece el propio
// documento (campos sobre una raya, como en papel) y a un lado se recuerda lo
// que se rellena solo y lo que pasa al pulsar «Generar PDF».

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
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className={LEGAL_LABEL}>{label}</span>
      {children}
      {hint && <span className="mt-1 block font-sans text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function LegalTemplateForm({
  action,
  projectName,
  warning,
  tip,
  children,
}: {
  action: string;
  projectName: string;
  warning?: string;
  tip?: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      method="POST"
      target="_blank"
      className="sheet mt-10 grid gap-x-12 gap-y-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_16rem]"
    >
      <div className="grid content-start gap-x-8 gap-y-6 sm:grid-cols-2">
        {children}
        <div className="flex flex-wrap items-center gap-4 pt-2 sm:col-span-2">
          <button type="submit" className="btn btn-primary">
            Generar PDF
          </button>
          <span className="font-sans text-xs text-muted">Se abre en otra pestaña, listo para imprimir y firmar.</span>
        </div>
      </div>

      <aside className="space-y-5 border-t border-line pt-6 font-sans text-sm leading-relaxed text-muted lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <div>
          <p className="eyebrow">Se rellena solo</p>
          <p className="mt-1.5 text-fg">«{projectName}»</p>
          <p>y el nombre de tu productora.</p>
        </div>
        {tip && <p>{tip}</p>}
        <p className="border-l-2 border-warn pl-3">
          {warning ?? "Es una plantilla orientativa: no sustituye a una asesoría legal y su validez depende del país."}
        </p>
      </aside>
    </form>
  );
}
