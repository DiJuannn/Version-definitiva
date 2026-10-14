"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { suggestReferences } from "@/lib/actions/moodboard";
import type { MoodboardProposal } from "@/lib/moodboard-ai";
import { MOODBOARD_AI_PRO_DAILY_LIMIT } from "@/lib/limits";

// Referencias con IA (1 gratis por proyecto, 10 al día con PRO): la IA lee el resumen del proyecto y propone tono,
// paleta, referencias e ideas. Nada entra al tablero hasta que se elige.
export function MoodboardAiPanel({
  open,
  onClose,
  projectId,
  isPro,
  usesLeft,
  aiLimit,
  onUsed,
  onBoardVersion,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  isPro: boolean;
  usesLeft: number;
  aiLimit: number;
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

  const row = "flex cursor-pointer items-start gap-3 py-3";
  const check = "mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Referencias con IA"
      size="md"
      description="La IA lee el resumen de tu proyecto (sinopsis, personajes y escenas) y sugiere referencias para el moodboard."
    >
      {!isPro && usesLeft <= 0 && !proposal ? (
        <div className="mt-5">
          <p className="font-sans text-sm text-muted">
            Ya has usado la sugerencia gratuita de este proyecto. Con PRO tienes hasta {MOODBOARD_AI_PRO_DAILY_LIMIT} al
            día en cada proyecto: tono, paleta, películas y series de referencia e ideas de fotografía, vestuario y
            sonido.
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
          <p className="eyebrow">Qué vas a recibir</p>
          <ul className="mt-2 space-y-1.5 font-sans text-sm text-fg">
            {[
              "Un tono y una paleta de color",
              "Películas, series y fotografía de referencia, con el porqué",
              "Ideas de fotografía, vestuario y sonido",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
            Nada entra al tablero hasta que lo elijas. Cuanto más completas estén la sinopsis y las escenas, mejores
            serán las sugerencias.
          </p>
          <p className="mt-4 border-l-2 border-accent pl-3 font-sans text-xs leading-relaxed text-muted">
            {isPro
              ? `Te quedan ${usesLeft} de ${aiLimit} hoy en este proyecto.`
              : "Tienes 1 sugerencia gratuita en este proyecto: úsala cuando la sinopsis y las escenas estén bien descritas."}
          </p>
          {error && (
            <p className="mt-4 border-l-2 border-danger pl-3 font-sans text-xs text-danger" role="alert">
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
          <p className="border-l-2 border-warn pl-3 font-sans text-xs leading-relaxed text-muted">
            <span className="font-medium text-fg">Compruébalas antes de fiarte.</span> La IA puede equivocarse con
            títulos, años o autores; el botón «Buscar» de cada tarjeta te ayuda.
          </p>
          <p className="mt-4 eyebrow">Marca lo que quieras llevar al tablero</p>
          <div className="mt-1 max-h-[45vh] divide-y divide-line overflow-y-auto border-y border-line pr-1">
            {(proposal.tone || proposal.palette.length > 0) && (
              <label className={row}>
                <input
                  type="checkbox"
                  checked={selected.has("tone")}
                  onChange={() => toggle("tone")}
                  className={check}
                />
                <span className="min-w-0">
                  <span className="font-mono text-[10px] tracking-widest text-accent uppercase">Tono y paleta</span>
                  <span className="mt-1 block font-sans text-sm">{proposal.tone}</span>
                  <span className="mt-2 flex gap-1">
                    {proposal.palette.map((c) => (
                      <span
                        key={c}
                        className="h-5 w-8 rounded-[3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                  </span>
                </span>
              </label>
            )}
            {proposal.references.map((r, i) => (
              <label key={i} className={row}>
                <input
                  type="checkbox"
                  checked={selected.has(`ref-${i}`)}
                  onChange={() => toggle(`ref-${i}`)}
                  className={check}
                />
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
                <input
                  type="checkbox"
                  checked={selected.has(`idea-${i}`)}
                  onChange={() => toggle(`idea-${i}`)}
                  className={check}
                />
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
            <button
              type="button"
              onClick={add}
              disabled={selected.size === 0}
              className="btn btn-primary disabled:opacity-60"
            >
              Añadir {selected.size} al tablero
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
