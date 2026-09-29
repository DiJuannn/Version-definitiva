import type { ReviewPayload } from "@/lib/services/review";
import { CATEGORY_LABEL, CORRECTION_STATUS, VERSION_STATUS } from "@/lib/domain/labels";
import { formatClock, formatTimecode } from "@/lib/domain/timecode";
import { fmtDateTime } from "@/lib/format";
import { PrintButton } from "./print-button";

/** Informe de revisión imprimible (Guardar como PDF desde el navegador). */
export function ReviewReport({ p }: { p: ReviewPayload }) {
  const fps = p.version.fps;
  const tc = (ms: number) => (fps ? formatTimecode(ms, fps) : formatClock(ms, true));
  const roots = p.comments
    .filter((c) => !c.parentId && !c.deleted)
    .sort((a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity) || a.createdAt.localeCompare(b.createdAt));
  const replies = (id: string) => p.comments.filter((c) => c.parentId === id && !c.deleted);
  const open = roots.filter((c) => c.correction && ["PENDING", "IN_PROGRESS"].includes(c.correction.status)).length;
  return (
    <div className="min-h-dvh bg-white text-ink print:bg-white">
      <div className="mx-auto max-w-3xl px-6 py-10 print:px-0 print:py-0">
        <div className="mb-6 flex items-start justify-between gap-4 print:hidden">
          <p className="text-[13px] text-ink-3">Vista de impresión. Usa «Guardar como PDF» en el diálogo de impresión.</p>
          <PrintButton />
        </div>
        <header className="border-b-2 border-ink pb-4">
          <p className="text-[12px] tracking-wider text-ink-3 uppercase">Informe de revisión</p>
          <h1 className="font-display text-2xl font-bold">
            {p.piece.title} — V{p.version.number}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {p.piece.projectName} · {VERSION_STATUS[p.version.status].label} · generado {fmtDateTime(new Date())}
          </p>
          <p className="mt-1 text-[13px] text-ink-3">
            {roots.length} comentarios · {open} correcciones abiertas · tiempos {fps ? `en timecode a ${fps} fps${p.version.fpsVerified ? "" : " (declarados)"}` : "en minutos:segundos.milisegundos"}
            {!p.me.internal ? "" : " · incluye comentarios internos"}
          </p>
        </header>
        {p.version.changeSummary && (
          <section className="mt-5">
            <h2 className="text-sm font-semibold">Cambios en esta versión</h2>
            <p className="mt-1 text-sm whitespace-pre-line text-ink-2">{p.version.changeSummary}</p>
          </section>
        )}
        {p.approvals.length > 0 && (
          <section className="mt-5">
            <h2 className="text-sm font-semibold">Decisiones</h2>
            <ul className="mt-1 text-sm text-ink-2">
              {p.approvals.map((a) => (
                <li key={a.id}>
                  {a.decision === "APPROVED" ? "Aprobada" : "Cambios solicitados"} por {a.actorName} — {fmtDateTime(a.createdAt)}
                  {a.revokedAt ? ` (revocada: ${a.revokeReason})` : ""}
                  {a.note ? ` — «${a.note}»` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
        <ol className="mt-6 flex flex-col">
          {roots.map((c, i) => (
            <li key={c.id} className="break-inside-avoid border-b border-line py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
                <span className="font-mono font-semibold">#{i + 1}</span>
                <span className="font-mono">{c.timeMs == null ? "General" : c.endMs != null ? `${tc(c.timeMs)} → ${tc(c.endMs)}` : tc(c.timeMs)}</span>
                <span className="font-medium">{c.author.name}</span>
                {c.visibility === "INTERNAL" && <span className="rounded bg-[var(--tone-attention-bg)] px-1 text-[11px] text-[var(--tone-attention)]">Interno</span>}
                {c.correction && (
                  <span className="text-ink-3">
                    {CATEGORY_LABEL[c.correction.category]} · {CORRECTION_STATUS[c.correction.status].label}
                  </span>
                )}
                {c.annotation && <span className="text-ink-3">· con dibujo</span>}
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
              {replies(c.id).map((r) => (
                <p key={r.id} className="mt-1 ml-5 text-[13px] text-ink-2">
                  ↳ <strong>{r.author.name}:</strong> {r.body}
                </p>
              ))}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
