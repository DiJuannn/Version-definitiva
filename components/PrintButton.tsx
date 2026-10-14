"use client";

export function PrintButton({ label = "Exportar PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-outline print:hidden">
      {label}
    </button>
  );
}
