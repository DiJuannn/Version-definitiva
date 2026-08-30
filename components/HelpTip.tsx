"use client";

import { useState } from "react";

export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label="Ayuda"
        aria-expanded={open}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-muted font-mono text-[9px] text-muted transition-colors hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 border border-line bg-bg-raised p-2.5 font-mono text-[11px] leading-relaxed text-fg shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
