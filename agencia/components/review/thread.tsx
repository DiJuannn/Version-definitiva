"use client";

import { useState } from "react";
import { History, Link2, Lock, MoreHorizontal, PenLine, Reply } from "lucide-react";
import type { CorrectionStatus } from "@prisma/client";
import { allowedCorrectionTargets } from "@/lib/domain/correction-status";
import { CATEGORY_LABEL, CORRECTION_STATUS, ROLE_LABEL } from "@/lib/domain/labels";
import { cx } from "@/components/ui/cx";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { MentionTextarea } from "./mention-textarea";
import { useDraft } from "./use-draft";
import type { ReviewComment } from "./types";

export const STATUS_COLOR: Record<CorrectionStatus, string> = {
  PENDING: "#FFD23F",
  IN_PROGRESS: "#3DC5CF",
  RESOLVED: "#6B9BFF",
  VERIFIED: "#3DDC97",
  DISMISSED: "#7C8490",
};

const STATUS_ACTION: Partial<Record<CorrectionStatus, string>> = {
  IN_PROGRESS: "Empezar",
  RESOLVED: "Marcar resuelta",
  VERIFIED: "Verificar",
  PENDING: "Reabrir",
  DISMISSED: "Descartar",
};

function Body({ text, people }: { text: string; people: { id: string; name: string }[] }) {
  // Enlaces y menciones resaltados; el resto es texto plano (sin HTML).
  const names = people.map((p) => p.name).sort((a, b) => b.length - a.length);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(https?://[^\\s<>"')]+)${names.length ? `|(@(?:${names.map(esc).join("|")}))` : ""}`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      out.push(
        <a key={m.index} href={m[1]} target="_blank" rel="noopener noreferrer nofollow" className="text-[#8fb3ff] underline underline-offset-2 break-all">
          {m[1]}
        </a>,
      );
    } else out.push(<span key={m.index} className="rounded bg-marker/15 px-0.5 font-medium text-marker">{m[2]}</span>);
    last = m.index! + m[0].length;
  }
  out.push(text.slice(last));
  return <p className="text-sm leading-relaxed whitespace-pre-wrap text-c-ink">{out}</p>;
}

export function Thread({
  c,
  n,
  replies,
  selected,
  onSelect,
  fmt,
  kind,
  canComment,
  locked,
  team,
  assignees,
  people,
  onReply,
  onEdit,
  onWithdraw,
  onCorrection,
  canWithdrawOthers,
  versionId,
  onSuggestCategory,
}: {
  c: ReviewComment;
  n: number;
  replies: ReviewComment[];
  selected: boolean;
  onSelect: () => void;
  fmt: (ms: number) => string;
  kind: "team" | "reviewer" | null;
  canComment: boolean;
  locked: boolean;
  team: boolean;
  assignees: { id: string; name: string }[];
  people: { id: string; name: string }[];
  onReply: (parentId: string, body: string, mentionIds: string[]) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onWithdraw: (id: string) => Promise<void>;
  onCorrection: (id: string, patch: Record<string, unknown>) => Promise<void>;
  canWithdrawOthers: boolean;
  versionId: string;
  onSuggestCategory?: (correctionId: string) => Promise<{ category: string; reason: string }>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply, clearReply] = useDraft(`corte:reply:${versionId}:${c.id}`, { body: "", mentionIds: [] as string[] });
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [aiSug, setAiSug] = useState<{ category: string; reason: string } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const corr = c.correction;
  const targets = corr && kind ? allowedCorrectionTargets(corr.status, kind) : [];
  const timeText = c.timeMs == null ? null : c.endMs != null ? `${fmt(c.timeMs)} → ${fmt(c.endMs)}` : fmt(c.timeMs);

  return (
    <article
      id={`c-${c.id}`}
      aria-labelledby={`c-${c.id}-h`}
      className={cx(
        "group relative border-b border-c-line px-4 py-3 transition-colors",
        selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
        corr?.status === "DISMISSED" || corr?.status === "VERIFIED" ? "opacity-75" : "",
      )}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-marker" />}
      <header id={`c-${c.id}-h`} className="flex items-center gap-2 text-[12px]">
        <span className="grid h-5 min-w-5 place-items-center rounded bg-white/10 px-1 font-mono text-[11px] text-c-ink-2">{n}</span>
        <span className="font-semibold text-c-ink">{c.author.name}</span>
        <span className="text-c-ink-3">{c.author.kind === "guest" ? "Invitado" : c.author.role ? ROLE_LABEL[c.author.role] : ""}</span>
        {c.visibility === "INTERNAL" && (
          <span className="inline-flex items-center gap-0.5 rounded bg-[#3a2f10] px-1 text-[11px] text-marker" title="Solo equipo de la agencia">
            <Lock className="size-3" /> Interno
          </span>
        )}
        <time className="ml-auto text-c-ink-3" dateTime={c.createdAt} title={fmtDateTime(c.createdAt)}>
          {fmtRelative(c.createdAt)}
        </time>
        {!c.deleted && (
          <div className="relative">
            <button type="button" aria-label="Más acciones" aria-expanded={menu} onClick={() => setMenu((m) => !m)} className="rounded p-0.5 text-c-ink-3 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-c-ink focus:opacity-100 aria-expanded:opacity-100">
              <MoreHorizontal className="size-4" />
            </button>
            {menu && (
              <div className="absolute top-6 right-0 z-20 w-44 overflow-hidden rounded-md border border-c-line bg-c-panel-2 py-1 text-[13px] shadow-xl" onMouseLeave={() => setMenu(false)}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-c-ink-2 hover:bg-white/8 hover:text-c-ink"
                  onClick={async () => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("c", c.id);
                    await navigator.clipboard?.writeText(url.toString()).catch(() => {});
                    setCopied(true);
                    setMenu(false);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <Link2 className="size-3.5" /> Copiar enlace
                </button>
                {c.mine && !locked && (
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-c-ink-2 hover:bg-white/8 hover:text-c-ink" onClick={() => { setEditing(c.body); setMenu(false); }}>
                    Editar
                  </button>
                )}
                {(c.mine || canWithdrawOthers) && !locked && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[#ff8a80] hover:bg-white/8"
                    onClick={() => {
                      setMenu(false);
                      if (confirm("¿Retirar este comentario? Quedará constancia en el historial.")) void run(() => onWithdraw(c.id));
                    }}
                  >
                    Retirar
                  </button>
                )}
                {corr && (
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-c-ink-2 hover:bg-white/8 hover:text-c-ink" onClick={() => { setShowHistory((s) => !s); setMenu(false); }}>
                    <History className="size-3.5" /> Historial
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {timeText && (
          <button type="button" onClick={onSelect} className="rounded bg-c-bg px-1.5 py-0.5 font-mono text-[12px] text-marker hover:bg-black" aria-label={`Ir a ${timeText}`}>
            {timeText}
          </button>
        )}
        {c.annotation && (
          <button type="button" onClick={onSelect} className="inline-flex items-center gap-1 text-[12px] text-c-ink-2 hover:text-c-ink" title="Ver dibujo sobre la imagen">
            <PenLine className="size-3.5" /> Dibujo
          </button>
        )}
        {!timeText && <span className="text-[12px] text-c-ink-3">General</span>}
      </div>

      <div className="mt-1.5" onClick={c.timeMs != null && !editing ? onSelect : undefined}>
        {c.deleted ? (
          <p className="text-sm text-c-ink-3 italic">Comentario retirado.</p>
        ) : editing !== null ? (
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <MentionTextarea value={editing} onChange={setEditing} people={people} onMention={() => {}} onSubmit={() => void run(async () => { await onEdit(c.id, editing); setEditing(null); })} ariaLabel="Editar comentario" rows={3} />
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={() => void run(async () => { await onEdit(c.id, editing); setEditing(null); })} className="h-7 rounded bg-marker px-2.5 text-[12px] font-semibold text-ink">
                Guardar
              </button>
              <button type="button" onClick={() => setEditing(null)} className="h-7 rounded px-2.5 text-[12px] text-c-ink-2 hover:bg-white/8">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <Body text={c.body} people={people} />
        )}
        {c.editedAt && !c.deleted && <p className="mt-0.5 text-[11px] text-c-ink-3">Editado {fmtRelative(c.editedAt)}</p>}
      </div>

      {corr && !c.deleted && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium" style={{ background: `${STATUS_COLOR[corr.status]}22`, color: STATUS_COLOR[corr.status] }}>
            <span className="size-1.5 rounded-full" style={{ background: STATUS_COLOR[corr.status] }} />
            {CORRECTION_STATUS[corr.status].label}
            {corr.addressedIn && corr.status === "RESOLVED" ? ` en V${corr.addressedIn}` : ""}
          </span>
          {team ? (
            <select
              aria-label="Categoría"
              value={corr.category}
              disabled={busy || locked}
              onChange={(e) => void run(() => onCorrection(corr.id, { category: e.target.value }))}
              className="h-6 rounded border border-c-line bg-transparent px-1 text-[11px] text-c-ink-2"
            >
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k} className="bg-c-panel">{v}</option>
              ))}
            </select>
          ) : (
            <span className="text-[11px] text-c-ink-3">{CATEGORY_LABEL[corr.category]}</span>
          )}
          {team && (
            <select
              aria-label="Responsable"
              value={corr.assignee?.id ?? ""}
              disabled={busy || locked}
              onChange={(e) => void run(() => onCorrection(corr.id, { assigneeId: e.target.value || null }))}
              className="h-6 max-w-32 rounded border border-c-line bg-transparent px-1 text-[11px] text-c-ink-2"
            >
              <option value="" className="bg-c-panel">Sin responsable</option>
              {assignees.map((p) => (
                <option key={p.id} value={p.id} className="bg-c-panel">{p.name}</option>
              ))}
            </select>
          )}
          {team && onSuggestCategory && !locked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(async () => setAiSug(await onSuggestCategory(corr.id)))}
              className="h-6 rounded px-1.5 text-[11px] text-c-ink-3 hover:bg-white/8 hover:text-c-ink"
              title="Propuesta de la IA; no se aplica sola"
            >
              Sugerir categoría (IA)
            </button>
          )}
          <span className="ml-auto flex gap-1">
            {!locked &&
              targets.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const note = t === "PENDING" || t === "DISMISSED" ? (prompt(t === "PENDING" ? "¿Por qué se reabre?" : "¿Por qué se descarta?") ?? undefined) : undefined;
                    if ((t === "PENDING" || t === "DISMISSED") && note === undefined) return;
                    void run(() => onCorrection(corr.id, { status: t, note }));
                  }}
                  className={cx(
                    "h-6 rounded px-2 text-[11px] font-medium",
                    t === "RESOLVED" || t === "VERIFIED" ? "bg-white/10 text-c-ink hover:bg-white/15" : "text-c-ink-2 hover:bg-white/8 hover:text-c-ink",
                  )}
                >
                  {STATUS_ACTION[t]}
                </button>
              ))}
          </span>
        </div>
      )}

      {aiSug && corr && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-c-line bg-c-bg p-2 text-[12px] text-c-ink-2">
          <span>
            Propuesta de la IA: <strong className="text-c-ink">{CATEGORY_LABEL[aiSug.category as keyof typeof CATEGORY_LABEL]}</strong> — {aiSug.reason}
          </span>
          <button type="button" className="rounded bg-white/10 px-2 py-0.5 text-c-ink" onClick={() => void run(async () => { await onCorrection(corr.id, { category: aiSug.category }); setAiSug(null); })}>
            Aplicar
          </button>
          <button type="button" className="px-1 text-c-ink-3" onClick={() => setAiSug(null)}>Descartar</button>
        </div>
      )}
      {showHistory && corr && (
        <ol className="mt-2 rounded-md bg-c-bg p-2 text-[11px] text-c-ink-2">
          {corr.history.map((h, i) => (
            <li key={i} className="flex gap-2 py-0.5">
              <span className="text-c-ink-3 tabular">{fmtDateTime(h.at)}</span>
              <span>
                {h.by}: {h.from ? `${CORRECTION_STATUS[h.from].label} → ` : ""}
                {CORRECTION_STATUS[h.to].label}
                {h.note ? ` — ${h.note}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}

      {replies.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2.5 border-l border-c-line pl-3">
          {replies.map((r) => (
            <li key={r.id} id={`c-${r.id}`}>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="font-semibold text-c-ink">{r.author.name}</span>
                {r.visibility === "INTERNAL" && <Lock className="size-3 text-marker" aria-label="Interno" />}
                <span className="text-c-ink-3">{fmtRelative(r.createdAt)}</span>
                {r.mine && !r.deleted && !locked && (
                  <button type="button" className="ml-auto text-[11px] text-c-ink-3 hover:text-c-ink" onClick={() => { if (confirm("¿Retirar esta respuesta?")) void run(() => onWithdraw(r.id)); }}>
                    Retirar
                  </button>
                )}
              </div>
              {r.deleted ? <p className="text-[13px] text-c-ink-3 italic">Respuesta retirada.</p> : <Body text={r.body} people={people} />}
            </li>
          ))}
        </ul>
      )}

      {canComment && !c.deleted && !locked && (
        <div className="mt-2">
          {replyOpen || reply.body ? (
            <div className="flex flex-col gap-2">
              <MentionTextarea
                value={reply.body}
                onChange={(body) => setReply((r) => ({ ...r, body }))}
                people={people}
                onMention={(p) => setReply((r) => ({ ...r, mentionIds: [...new Set([...r.mentionIds, p.id])] }))}
                onSubmit={() => void run(async () => { await onReply(c.id, reply.body, reply.mentionIds); clearReply(); setReplyOpen(false); })}
                rows={2}
                ariaLabel="Responder"
                placeholder="Responder…"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !reply.body.trim()}
                  onClick={() => void run(async () => { await onReply(c.id, reply.body, reply.mentionIds); clearReply(); setReplyOpen(false); })}
                  className="h-7 rounded bg-marker px-2.5 text-[12px] font-semibold text-ink disabled:opacity-40"
                >
                  Responder
                </button>
                <button type="button" onClick={() => { clearReply(); setReplyOpen(false); }} className="h-7 rounded px-2.5 text-[12px] text-c-ink-2 hover:bg-white/8">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setReplyOpen(true)} className="inline-flex items-center gap-1 text-[12px] text-c-ink-3 hover:text-c-ink">
              <Reply className="size-3.5" /> Responder{replies.length ? "" : ""}
            </button>
          )}
        </div>
      )}
      {copied && <p role="status" className="mt-1 text-[11px] text-[#3DDC97]">Enlace copiado</p>}
      {err && <p role="alert" className="mt-1 text-[12px] text-[#ff8a80]">{err}</p>}
    </article>
  );
}
