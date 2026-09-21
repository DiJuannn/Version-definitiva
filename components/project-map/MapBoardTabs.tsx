"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { DangerConfirmButton } from "@/components/DangerConfirmButton";
import { createMapBoard, deleteMapBoard, renameMapBoard, setMapBoardSharing } from "@/lib/actions/project-map";
import type { MapBoardInfo } from "@/lib/project-map-types";

// Pestañas de las pizarras del proyecto (una o varias), con crear, renombrar, borrar y
// compartir por enlace público. Cada pestaña es un enlace (?pizarra=id) para que el servidor
// cargue solo la que se ve.
export function MapBoardTabs({
  projectId,
  boards,
  activeId,
  shareUrl,
}: {
  projectId: string;
  boards: MapBoardInfo[];
  activeId: string;
  // Enlace público de la pizarra activa (null = no compartida).
  shareUrl: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<null | "new" | "rename" | "share">(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const [link, setLink] = useState<string | null>(shareUrl);

  const base = `/app/${projectId}/resumen?vista=mapa`;
  const active = boards.find((b) => b.id === activeId);

  function open(next: typeof mode) {
    setMode(mode === next ? null : next);
    setError(null);
    setName(next === "rename" ? (active?.name ?? "") : "");
  }

  function create() {
    startTransition(async () => {
      const r = await createMapBoard(projectId, name);
      if (!r.ok) return setError({ text: r.error, upgrade: r.upgrade });
      setMode(null);
      router.push(`${base}&pizarra=${r.id}`);
    });
  }

  function rename() {
    startTransition(async () => {
      const r = await renameMapBoard(projectId, activeId, name);
      if (!r.ok) return setError({ text: "No se pudo renombrar." });
      setMode(null);
      router.refresh();
    });
  }

  function share(enabled: boolean) {
    startTransition(async () => {
      const r = await setMapBoardSharing(projectId, activeId, enabled);
      if (!r.ok) return setError({ text: r.error, upgrade: r.upgrade });
      setError(null);
      setLink(r.token ? `${window.location.origin}/pizarra/${r.token}` : null);
      router.refresh();
    });
  }

  async function remove() {
    const r = await deleteMapBoard(projectId, activeId);
    if (!r.ok) {
      setError({ text: r.error ?? "No se pudo borrar." });
      return;
    }
    router.push(base);
    router.refresh();
  }

  const tab = (isActive: boolean) =>
    `shrink-0 border px-3 py-1.5 font-mono text-[11px] tracking-wider uppercase transition-colors ${
      isActive ? "border-accent text-accent" : "border-line text-muted hover:text-fg"
    }`;
  const small = "font-mono text-[11px] tracking-wider text-muted uppercase hover:text-accent";

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Pizarras del proyecto" className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {boards.map((b) => (
            <Link key={b.id} href={`${base}&pizarra=${b.id}`} aria-current={b.id === activeId ? "page" : undefined} className={tab(b.id === activeId)}>
              {b.name}
              {b.shared && <span className="ml-1.5 text-[9px] text-success" title="Compartida con un enlace">●</span>}
            </Link>
          ))}
          <button type="button" onClick={() => open("new")} className={tab(mode === "new")} aria-expanded={mode === "new"}>
            + Nueva pizarra
          </button>
        </nav>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => open("share")} className={small} aria-expanded={mode === "share"}>
            Compartir
          </button>
          <button type="button" onClick={() => open("rename")} className={small} aria-expanded={mode === "rename"}>
            Renombrar
          </button>
          {boards.length > 1 && (
            <DangerConfirmButton
              trigger="Eliminar"
              triggerClassName={small}
              title="¿Eliminar esta pizarra?"
              description={`Se borrará la pizarra «${active?.name ?? ""}» con todo lo que tiene. No afecta a los datos del proyecto (escenas, tareas…), solo a esta pizarra. No se puede deshacer.`}
              confirmLabel="Sí, eliminar"
              action={remove}
            />
          )}
        </div>
      </div>

      {(mode === "new" || mode === "rename") && (
        <form
          className="mt-3 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "new") create();
            else rename();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "new" ? "Nombre de la pizarra (p. ej. Look de la película)" : "Nuevo nombre"}
            maxLength={60}
            autoFocus
            aria-label="Nombre de la pizarra"
            className="min-w-0 flex-1 border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button type="submit" disabled={pending} className="btn btn-secondary disabled:opacity-60">
            {pending ? "…" : mode === "new" ? "Crear" : "Guardar"}
          </button>
        </form>
      )}

      {mode === "share" && (
        <div className="mt-3 max-w-2xl border border-line p-4">
          <p className="font-sans text-sm text-muted">
            {link
              ? "Cualquiera con este enlace puede ver esta pizarra, sin cuenta y solo en lectura."
              : "Crea un enlace de solo lectura para enseñar esta pizarra a quien quieras, sin que necesite cuenta."}{" "}
            <strong className="font-semibold text-fg">Verán todo lo que hay en ella</strong>, incluidas las tarjetas con datos del proyecto
            (presupuesto, tareas…): oculta las que no quieras enseñar.
          </p>
          {link ? (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="min-w-0 max-w-full truncate font-mono text-xs text-muted" title={link}>
                {link}
              </span>
              <CopyLinkButton link={link} />
              <button type="button" disabled={pending} onClick={() => share(false)} className="link-action disabled:opacity-60">
                {pending ? "Quitando…" : "Dejar de compartir"}
              </button>
            </div>
          ) : (
            <button type="button" disabled={pending} onClick={() => share(true)} className="btn btn-secondary mt-3 disabled:opacity-60">
              {pending ? "Creando…" : "Crear enlace"}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 font-mono text-xs text-danger" role="alert">
          {error.text}{" "}
          {error.upgrade && (
            <Link href="/app/organizacion" className="underline">
              Ver PRO →
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
