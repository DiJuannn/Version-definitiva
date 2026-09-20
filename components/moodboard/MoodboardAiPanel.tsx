"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { suggestReferences } from "@/lib/actions/moodboard";
import type { MoodboardProposal } from "@/lib/moodboard-ai";

// Referencias con IA (PRO): la IA lee el resumen del proyecto y propone tono,
// paleta, referencias e ideas. Nada entra al tablero hasta que se elige.
export function MoodboardAiPanel({
  open,
  onClose,
  projectId,
  isPro,
  usesLeft,
  onUsed,
  onBoardVersion,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  isPro: boolean;
  usesLeft: number;
  onUsed: () => void;
  onBoardVersion: (updatedAt: string | null) => void;
  onAdd: (proposal: MoodboardProposal, keys: Set<string>) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [proposal, setProposal] = useState<MoodboardProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function generate() {
    setError(null);
    setUpgrade(false);
    startTransition(async () => {
      const result = await suggestReferences(projectId);
      if (!result.ok) {
        setError(result.error);
        setUpgrade(Boolean(result.upgrade));
        return;
      }
      onUsed();
      onBoardVersion(result.boardUpdatedAt);
      const keys = new Set<string>();
      if (result.proposal.palette.length > 0 || result.proposal.tone) keys.add("tone");
      result.proposal.references.forEach((_, i) => keys.add(`ref-${i}`));
      result.proposal.ideas.forEach((_, i) => keys.add(`idea-${i}`));
      setSelected(keys);
      setProposal(result.proposal);
    });
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function add() {
    if (!proposal) return;
    onAdd(proposal, selected);
    setProposal(null);
    onClose();
  }

  const row = "flex cursor-pointer items-start gap-3 border-b border-line py-3";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Referencias con IA"
      description="La IA lee el resumen de tu proyecto (sinopsis, personajes y escenas) y sugiere referencias para el moodboard."
    >
      {!isPro ? (
        <div className="mt-5">
          <p className="font-sans text-sm text-muted">
            Es una función de PRO: tono, paleta de colores, películas y series de referencia e ideas de
            fotografía, vestuario y sonido, pensadas para tu proyecto.
          </p>
          <div className="mt-5 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="link-action">
              Ahora no
            </button>
            <Link href="/app/organizacion" className="btn btn-primary">
              Ver PRO
            </Link>
          </div>
        </div>
      ) : !proposal ? (
        <div className="mt-5">
          <p className="font-sans text-xs text-muted">
            Consejo: cuanto más completa esté la sinopsis y las descripciones de escena, mejores serán las
            sugerencias. Te quedan {usesLeft} hoy en este proyecto.
          </p>
          {error && (
            <p className="mt-3 font-mono text-xs text-danger" role="alert">
              {error}{" "}
              {upgrade && (
                <Link href="/app/organizacion" className="underline">
                  Ver planes →
                </Link>
              )}
            </p>
          )}
          <div className="mt-5 flex items-center justify-end gap-4">
            <button type="button" onClick={onClose} className="link-action">
              Cancelar
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={pending || usesLeft <= 0}
              className="btn btn-primary disabled:opacity-60"
            >
              {pending ? "Pensando referencias… (~20 s)" : usesLeft <= 0 ? "Sin usos hoy" : "Generar referencias"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="border border-warn/40 p-3 font-sans text-xs text-warn">
            ⚠ La IA puede equivocarse con títulos, años o autores. Comprueba cada referencia (el botón
            «Buscar» de la tarjeta te ayuda) antes de fiarte de ella.
          </p>
          <div className="mt-2 max-h-[45vh] overflow-y-auto pr-1">
            {(proposal.tone || proposal.palette.length > 0) && (
              <label className={row}>
                <input type="checkbox" checked={selected.has("tone")} onChange={() => toggle("tone")} className="mt-1" />
                <span className="min-w-0">
                  <span className="font-mono text-[10px] tracking-widest text-accent uppercase">Tono y paleta</span>
                  <span className="mt-1 block font-sans text-sm">{proposal.tone}</span>
                  <span className="mt-2 flex gap-1">
                    {proposal.palette.map((c) => (
                      <span key={c} className="h-5 w-8" style={{ background: c }} title={c} />
                    ))}
                  </span>
                </span>
              </label>
            )}
            {proposal.references.map((r, i) => (
              <label key={i} className={row}>
                <input type="checkbox" checked={selected.has(`ref-${i}`)} onChange={() => toggle(`ref-${i}`)} className="mt-1" />
                <span className="min-w-0">
                  <span className="font-mono text-[10px] tracking-widest text-accent uppercase">{r.kind}</span>
                  <span className="mt-0.5 block font-display text-sm font-bold">
                    {r.title}
                    {r.year ? ` (${r.year})` : ""}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs text-muted">{r.why}</span>
                </span>
              </label>
            ))}
            {proposal.ideas.map((idea, i) => (
              <label key={i} className={row}>
                <input type="checkbox" checked={selected.has(`idea-${i}`)} onChange={() => toggle(`idea-${i}`)} className="mt-1" />
                <span className="min-w-0">
                  <span className="font-mono text-[10px] tracking-widest text-accent uppercase">{idea.topic}</span>
                  <span className="mt-0.5 block font-sans text-xs text-muted">{idea.text}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setProposal(null)} className="link-action">
              ← Volver a pedir
            </button>
            <button type="button" onClick={add} disabled={selected.size === 0} className="btn btn-primary disabled:opacity-60">
              Añadir {selected.size} al tablero
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
