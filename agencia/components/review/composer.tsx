"use client";

import { useRef, useState } from "react";
import { Clock, Lock, PenLine, Send, SplitSquareHorizontal, Globe } from "lucide-react";
import type { CorrectionCategory } from "@prisma/client";
import type { Shape } from "@/lib/domain/annotation";
import { CATEGORY_LABEL } from "@/lib/domain/labels";
import { cx } from "@/components/ui/cx";
import { MentionTextarea } from "./mention-textarea";

export type Draft = {
  body: string;
  mode: "instant" | "range" | "general";
  timeMs: number | null;
  range: { start: number; end: number } | null;
  shapes: Shape[];
  visibility: "CLIENT" | "INTERNAL";
  isCorrection: boolean;
  category: CorrectionCategory;
  mentionIds: string[];
};

export const EMPTY_DRAFT: Draft = {
  body: "",
  mode: "instant",
  timeMs: null,
  range: null,
  shapes: [],
  visibility: "CLIENT",
  isCorrection: true,
  category: "OTHER",
  mentionIds: [],
};

export function Composer({
  draft,
  setDraft,
  fmt,
  currentMs,
  onFocusCapture,
  onToggleDraw,
  drawing,
  canInternal,
  forcedInternal,
  internal,
  people,
  onSend,
  sending,
  error,
  disabledReason,
  compact,
}: {
  draft: Draft;
  setDraft: (d: Draft | ((d: Draft) => Draft)) => void;
  fmt: (ms: number) => string;
  currentMs: number;
  onFocusCapture: () => void;
  onToggleDraw: () => void;
  drawing: boolean;
  canInternal: boolean;
  forcedInternal: boolean;
  internal: boolean;
  people: { id: string; name: string }[];
  onSend: () => void;
  sending: boolean;
  error: string;
  disabledReason: string | null;
  compact?: boolean;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [showOpts, setShowOpts] = useState(false);
  if (disabledReason) {
    return <p className="border-t border-c-line px-4 py-3 text-[13px] text-c-ink-3">{disabledReason}</p>;
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const timeLabel =
    draft.mode === "general"
      ? "General"
      : draft.mode === "range" && draft.range
        ? `${fmt(draft.range.start)} → ${fmt(draft.range.end)}`
        : fmt(draft.timeMs ?? currentMs);
  const isInternal = forcedInternal || draft.visibility === "INTERNAL";

  return (
    <div className={cx("border-t border-c-line bg-c-panel", compact ? "p-2" : "p-3")} id="composer">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <div className="inline-flex rounded-md bg-c-bg p-0.5" role="radiogroup" aria-label="Momento del comentario">
          {(
            [
              ["instant", "Instante", Clock],
              ["range", "Tramo", SplitSquareHorizontal],
              ["general", "General", Globe],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={draft.mode === m}
              onClick={() => {
                if (m === "range" && !draft.range) set({ mode: m, range: { start: currentMs, end: currentMs + 3000 } });
                else if (m === "instant") set({ mode: m, timeMs: currentMs });
                else set({ mode: m, ...(m === "general" ? { shapes: [] } : {}) });
              }}
              className={cx("inline-flex h-7 items-center gap-1 rounded px-2 text-[12px]", draft.mode === m ? "bg-white/12 text-c-ink" : "text-c-ink-3 hover:text-c-ink")}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (draft.mode === "range" ? set({ range: { start: currentMs, end: Math.max(currentMs + 1000, draft.range?.end ?? currentMs + 3000) } }) : set({ timeMs: currentMs }))}
          aria-label="Usar la posición actual del vídeo"
          disabled={draft.mode === "general"}
          className="h-7 rounded bg-c-bg px-2 font-mono text-[12px] text-marker disabled:text-c-ink-3"
          title="Usar la posición actual del vídeo"
        >
          {timeLabel}
        </button>
        {draft.mode !== "general" && (
          <button
            type="button"
            onClick={onToggleDraw}
            aria-pressed={drawing}
            className={cx("ml-auto inline-flex h-7 items-center gap-1 rounded px-2 text-[12px]", drawing ? "bg-marker text-ink" : "text-c-ink-2 hover:bg-white/8 hover:text-c-ink")}
          >
            <PenLine className="size-3.5" /> {draft.shapes.length ? `Dibujo (${draft.shapes.length})` : "Dibujar"}
          </button>
        )}
      </div>
      <MentionTextarea
        ref={ta}
        value={draft.body}
        onChange={(body) => set({ body })}
        people={people}
        onMention={(p) => setDraft((d) => ({ ...d, mentionIds: [...new Set([...d.mentionIds, p.id])] }))}
        onSubmit={onSend}
        onFocus={onFocusCapture}
        rows={compact ? 2 : 3}
        ariaLabel="Escribe un comentario"
        placeholder={draft.mode === "general" ? "Comentario general sobre esta versión…" : "Describe el cambio. Usa @ para mencionar."}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {internal && (
          <button
            type="button"
            onClick={() => setShowOpts((s) => !s)}
            className="text-[12px] text-c-ink-3 underline-offset-2 hover:text-c-ink hover:underline"
            aria-expanded={showOpts}
          >
            {draft.isCorrection ? `Corrección · ${CATEGORY_LABEL[draft.category]}` : "Solo comentario"}
          </button>
        )}
        {!internal && (
          <label className="flex items-center gap-1.5 text-[12px] text-c-ink-2">
            <input type="checkbox" className="accent-[var(--marker)]" checked={draft.isCorrection} onChange={(e) => set({ isCorrection: e.target.checked })} />
            Es un cambio a hacer
          </label>
        )}
        {canInternal && (
          <button
            type="button"
            disabled={forcedInternal}
            onClick={() => set({ visibility: draft.visibility === "INTERNAL" ? "CLIENT" : "INTERNAL" })}
            aria-pressed={isInternal}
            title={forcedInternal ? "Esta versión aún no se ha publicado: toda la conversación es interna" : "Alternar comentario interno"}
            className={cx(
              "inline-flex h-7 items-center gap-1 rounded px-2 text-[12px]",
              isInternal ? "bg-[#3a2f10] text-marker" : "text-c-ink-2 hover:bg-white/8",
            )}
          >
            <Lock className="size-3.5" /> {isInternal ? "Interno" : "Visible al cliente"}
          </button>
        )}
        {forcedInternal && !canInternal && internal && (
          <span className="inline-flex items-center gap-1 text-[12px] text-marker">
            <Lock className="size-3.5" /> Interno
          </span>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={sending || !draft.body.trim()}
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-marker px-3 text-[13px] font-semibold text-ink disabled:opacity-40"
        >
          <Send className="size-3.5" /> {sending ? "Enviando…" : "Enviar"}
          <kbd className="hidden font-mono text-[10px] opacity-60 sm:inline">⌘↵</kbd>
        </button>
      </div>
      {internal && showOpts && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-c-bg p-2">
          <label className="flex items-center gap-1.5 text-[12px] text-c-ink-2">
            <input type="checkbox" className="accent-[var(--marker)]" checked={draft.isCorrection} onChange={(e) => set({ isCorrection: e.target.checked })} />
            Crear corrección
          </label>
          <select
            value={draft.category}
            onChange={(e) => set({ category: e.target.value as CorrectionCategory })}
            aria-label="Categoría"
            className="h-7 rounded border border-c-line bg-c-panel px-1.5 text-[12px] text-c-ink"
          >
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-[#ff8a80]">
          {error} Tu texto sigue guardado aquí.
        </p>
      )}
    </div>
  );
}
