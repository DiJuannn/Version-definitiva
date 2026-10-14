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
          className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg bg-[#16131e] p-3 font-sans text-[12px] leading-relaxed text-[#ecebe6] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}
