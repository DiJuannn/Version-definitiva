"use client";

export function PrintButton({ label = "Exportar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-line px-5 py-2 font-mono text-xs tracking-widest uppercase transition-colors hover:border-accent hover:text-accent print:hidden"
    >
      {label}
    </button>
  );
}
