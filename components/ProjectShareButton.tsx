"use client";

import { useRef, useState } from "react";
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
}: {
  projectId: string;
  origin: string;
  shares: ShareEntry[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Compartir proyecto"
        aria-expanded={open}
        className={`flex h-8 w-8 items-center justify-center border transition-colors ${
          open ? "border-accent text-accent" : "border-line text-muted hover:border-accent hover:text-accent"
        }`}
      >
        <ShareIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 border border-line bg-bg p-4 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              Compartir proyecto
            </p>
            <form action={createProjectShare.bind(null, projectId)}>
              <SubmitButton
                pendingLabel="Generando…"
                className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
              >
                + Generar enlace
              </SubmitButton>
            </form>
          </div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
            Quien entre con este enlace verá y podrá editar solo este
            proyecto — no el resto de tu organización.
          </p>

          {shares.length > 0 && (
            <div className="mt-4 divide-y divide-line border-t border-line">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs">
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
                        className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
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
