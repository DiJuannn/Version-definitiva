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
    <section aria-labelledby="cs-share" className="print:hidden">
      <h2 id="cs-share" className="font-display text-lg font-bold">
        Enlace para el equipo
      </h2>
      <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
        {link
          ? "Cualquiera con el enlace ve esta hoja sin cuenta. Solo lectura, sin teléfonos ni correos."
          : "Un enlace de solo lectura para mandarlo por WhatsApp. El equipo no necesita cuenta."}
      </p>
      {link ? (
        <>
          <p
            className="mt-3 truncate border-l-2 border-success pl-3 font-mono text-xs text-fg"
            title={link}
          >
            {link}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <CopyLinkButton link={link} />
            <button
              type="button"
              disabled={pending}
              onClick={() => change(false)}
              className="link-action hover:!text-danger disabled:opacity-60"
            >
              {pending ? "Quitando…" : "Dejar de compartir"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => change(true)}
          className="btn btn-primary mt-4"
        >
          {pending ? "Creando…" : "Crear enlace"}
        </button>
      )}
      {error && (
        <p
          className="mt-3 border-l-2 border-danger pl-3 font-sans text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
