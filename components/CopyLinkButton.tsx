"use client";

import { useState } from "react";

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="font-mono text-[11px] tracking-widest text-accent uppercase hover:opacity-80"
    >
      {copied ? "Copiado ✓" : "Copiar enlace"}
    </button>
  );
}
