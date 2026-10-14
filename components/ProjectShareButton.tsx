"use client";

import { useActionState, useRef, useState } from "react";
import { createProjectShare, revokeProjectShare } from "@/lib/actions/project-shares";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DeleteButton } from "@/components/DeleteButton";
import { ShareIcon } from "@/components/ToolIcons";
import { SubmitButton } from "@/components/SubmitButton";
import { useClickOutside } from "@/lib/use-click-outside";

type ShareEntry = {
  id: string;
  token: string;
  acceptedAt: string | null;
  userEmail: string | null;
};

// Compartir aquí es distinto de invitar en Organización: esto da acceso a
// UN solo proyecto, a cualquier persona con cuenta en la plataforma, sin
// meterla en tu organización ni dejarle ver el resto de tus proyectos.
export function ProjectShareButton({
  projectId,
  origin,
  shares,
  variant = "icon",
}: {
  projectId: string;
  origin: string;
  shares: ShareEntry[];
  // "icon": botón redondo discreto (filas de proyectos); "button": botón con texto (cabecera).
  variant?: "icon" | "button";
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, open, () => setOpen(false));
  const [shareState, createShareAction] = useActionState(
    createProjectShare.bind(null, projectId),
    undefined,
  );

  return (
    <div ref={containerRef} className="relative">
      {variant === "button" ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`btn btn-outline ${open ? "border-accent text-accent" : ""}`}
        >
          <ShareIcon className="h-3.5 w-3.5" />
          Compartir
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Compartir proyecto"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            open ? "bg-accent/10 text-accent" : "text-muted hover:bg-fg/5 hover:text-accent"
          }`}
        >
          <ShareIcon className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Compartir proyecto"
          className="sheet absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] p-5 text-left"
        >
          <p className="font-display text-base font-bold">Compartir este proyecto</p>
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted">
            Quien entre con el enlace podrá ver y editar solo este proyecto, no el resto de tu organización.
          </p>
          <form action={createShareAction} className="mt-4">
            <SubmitButton pendingLabel="Generando…" className="btn btn-secondary btn-sm w-full">
              Generar enlace de invitación
            </SubmitButton>
          </form>
          {shareState?.error && (
            <p className="mt-2 font-sans text-xs text-danger" role="alert">{shareState.error}</p>
          )}

          {shares.length > 0 && (
            <div className="mt-4 divide-y divide-line border-t border-line">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className={`truncate font-sans text-[13px] ${share.userEmail ? "" : "text-muted"}`}>
                      {share.userEmail ?? "Pendiente de aceptar"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {!share.acceptedAt && (
                      <CopyLinkButton
                        link={`${origin}/app/proyectos/compartido/${share.token}`}
                      />
                    )}
                    <form action={revokeProjectShare.bind(null, projectId, share.id)}>
                      <DeleteButton
                        confirmMessage="¿Revocar el acceso a este proyecto?"
                        className="link-action hover:!text-danger"
                      >
                        Revocar
                      </DeleteButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
