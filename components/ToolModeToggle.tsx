"use client";

import { useTransition } from "react";
import { setToolMode } from "@/lib/actions/tool-mode";
import type { ToolMode } from "@/lib/tool-rules";

// Cambia entre «solo lo que toca» y «todas las herramientas» (se recuerda en este dispositivo).
export function ToolModeToggle({ mode, className, label }: { mode: ToolMode; className?: string; label?: string }) {
  const [pending, startTransition] = useTransition();
  const next: ToolMode = mode === "simple" ? "full" : "simple";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setToolMode(next))}
      className={className ?? "link-action disabled:opacity-60"}
    >
      {pending ? "…" : (label ?? (mode === "simple" ? "Mostrar todas las herramientas" : "Volver al modo simple"))}
    </button>
  );
}
