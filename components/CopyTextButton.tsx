"use client";

import { useState } from "react";

// Como CopyLinkButton, pero para un bloque de texto largo (los créditos) en vez de un enlace.
export function CopyTextButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="btn btn-outline"
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
