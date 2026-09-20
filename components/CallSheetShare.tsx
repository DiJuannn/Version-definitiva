"use client";

import { useState, useTransition } from "react";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { setCallSheetSharing } from "@/lib/actions/call-sheets";

// Enlace público de solo lectura al call sheet: cualquiera que lo tenga lo ve
// sin cuenta (pensado para mandarlo por WhatsApp al equipo). Se puede apagar
// en cualquier momento y el enlace deja de funcionar.
export function CallSheetShare({
  projectId,
  dayId,
  link,
}: {
  projectId: string;
  dayId: string;
  link: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function change(enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setCallSheetSharing(projectId, dayId, enabled);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mt-6 border border-line p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Enlace para el equipo
          </p>
          <p className="mt-1 font-sans text-sm text-muted">
            {link
              ? "Cualquiera con este enlace puede ver el call sheet, sin cuenta. Solo lectura."
              : "Genera un enlace de solo lectura para mandarlo por WhatsApp, sin que el equipo necesite cuenta."}
          </p>
        </div>
        {link ? (
          <div className="flex items-center gap-4">
            <CopyLinkButton link={link} />
            <button
              type="button"
              disabled={pending}
              onClick={() => change(false)}
              className="link-action disabled:opacity-60"
            >
              {pending ? "Quitando…" : "Dejar de compartir"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => change(true)}
            className="btn btn-secondary disabled:opacity-60"
          >
            {pending ? "Creando…" : "Crear enlace"}
          </button>
        )}
      </div>
      {link && (
        <p className="mt-3 truncate font-mono text-xs text-muted" title={link}>
          {link}
        </p>
      )}
      {error && (
        <p className="mt-2 font-mono text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
