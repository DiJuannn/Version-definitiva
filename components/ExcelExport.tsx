"use client";

import { useState } from "react";

// Descarga el .xlsx y, para quien no tiene Excel instalado, enseña cómo abrirlo
// en Google Sheets (que lo convierte solo, con las fórmulas incluidas).
export function ExcelExport({ href }: { href: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative print:hidden">
      <a
        href={href}
        download
        onClick={() => setOpen(true)}
        className="btn btn-outline inline-flex items-center gap-1.5"
      >
        Excel / Google Sheets
      </a>

      {open && (
        <div
          role="status"
          className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] border border-line bg-bg-raised p-4 shadow-lg shadow-black/40"
        >
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">Descargando el presupuesto</p>
          <p className="mt-2 font-sans text-sm text-muted">
            Es un archivo .xlsx con fórmulas. Ábrelo con Excel, o con Google Sheets:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 font-sans text-sm text-muted">
            <li>Abre Google Sheets con el botón de abajo.</li>
            <li>
              <span className="text-fg">Archivo → Importar → Subir</span> y elige el archivo descargado.
            </li>
            <li>Pulsa &ldquo;Importar datos&rdquo;. Los totales se recalculan solos.</li>
          </ol>
          <p className="mt-2 font-sans text-xs text-muted">
            También vale arrastrarlo a Google Drive y abrirlo con &ldquo;Hojas de cálculo de Google&rdquo;.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <a
              href="https://docs.google.com/spreadsheets/u/0/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm"
            >
              Abrir Google Sheets
            </a>
            <button type="button" onClick={() => setOpen(false)} className="link-action">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
