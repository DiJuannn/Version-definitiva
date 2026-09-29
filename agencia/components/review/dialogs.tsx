"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

/** Diálogo modal nativo (<dialog>): foco atrapado y cierre con Esc. */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => e.stopPropagation()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-md"} rounded-xl border border-c-line bg-c-panel p-0 text-c-ink shadow-2xl backdrop:bg-black/60`}
      aria-labelledby="dlg-title"
    >
      {open && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id="dlg-title" className="font-display text-lg font-bold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-c-ink-3 hover:bg-white/10 hover:text-c-ink">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function DecisionDialog({
  open,
  onClose,
  decision,
  versionLabel,
  openCount,
  resolvedCount,
  policy,
  onBehalf,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  decision: "APPROVED" | "CHANGES_REQUESTED";
  versionLabel: string;
  openCount: number;
  resolvedCount: number;
  policy: "BLOCK_IF_OPEN" | "ALLOW_WITH_ACK";
  onBehalf: boolean;
  onConfirm: (note: string, ack: boolean) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const approve = decision === "APPROVED";
  const blocked = approve && openCount > 0 && policy === "BLOCK_IF_OPEN";
  const needAck = approve && openCount > 0 && policy === "ALLOW_WITH_ACK";
  const noteRequired = onBehalf;
  return (
    <Modal open={open} onClose={onClose} title={approve ? `Aprobar ${versionLabel}` : `Pedir cambios en ${versionLabel}`}>
      <div className="flex flex-col gap-3 text-sm">
        {approve ? (
          <p className="text-c-ink-2">
            Apruebas <strong className="text-c-ink">exactamente esta versión ({versionLabel})</strong>. Quedará registrado quién y cuándo, y la versión se bloqueará para que no cambie.
          </p>
        ) : (
          <p className="text-c-ink-2">El equipo recibirá aviso para preparar una nueva versión con los cambios que has dejado en los comentarios.</p>
        )}
        {approve && openCount > 0 && (
          <div className={`rounded-md border px-3 py-2 text-[13px] ${blocked ? "border-[#ff8a80]/40 bg-[#ff8a80]/10 text-[#ffb4ab]" : "border-marker/40 bg-marker/10 text-marker"}`}>
            Hay {openCount} {openCount === 1 ? "corrección abierta" : "correcciones abiertas"}.
            {blocked ? " La política de la agencia exige resolverlas o descartarlas antes de aprobar." : " Si apruebas igualmente, quedarán registradas como pendientes en el momento de la aprobación."}
          </div>
        )}
        {approve && resolvedCount > 0 && <p className="text-[13px] text-c-ink-3">{resolvedCount} marcadas como resueltas por el equipo sin verificar.</p>}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{onBehalf ? "¿Por qué canal llegó la decisión del cliente?" : "Nota (opcional)"}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-md border border-c-line bg-c-bg px-3 py-2 text-sm focus:border-marker/70 focus:outline-none"
            placeholder={onBehalf ? "Email de Marta del 12/10, llamada…" : approve ? "Todo perfecto." : "Resumen de lo que hay que cambiar"}
          />
        </label>
        {needAck && (
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-[var(--marker)]" />
            Apruebo esta versión aunque haya correcciones abiertas.
          </label>
        )}
        {err && <p role="alert" className="text-[13px] text-[#ff8a80]">{err}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[13px] text-c-ink-2 hover:bg-white/10">Cancelar</button>
          <button
            type="button"
            disabled={busy || blocked || (needAck && !ack) || (noteRequired && !note.trim())}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                await onConfirm(note, ack);
                setNote("");
                setAck(false);
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className={`h-9 rounded-md px-4 text-[13px] font-semibold disabled:opacity-40 ${approve ? "bg-[#3DDC97] text-ink" : "bg-marker text-ink"}`}
          >
            {busy ? "Guardando…" : approve ? `Aprobar ${versionLabel}` : "Pedir cambios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function NoteDialog({
  open,
  onClose,
  title,
  description,
  label,
  required,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  label: string;
  required?: boolean;
  confirmLabel: string;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="text-c-ink-2">{description}</div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{label}{!required && <span className="ml-1 font-normal text-c-ink-3">opcional</span>}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="rounded-md border border-c-line bg-c-bg px-3 py-2 text-sm focus:border-marker/70 focus:outline-none" />
        </label>
        {err && <p role="alert" className="text-[13px] text-[#ff8a80]">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-[13px] text-c-ink-2 hover:bg-white/10">Cancelar</button>
          <button
            type="button"
            disabled={busy || (required && !note.trim())}
            onClick={async () => {
              setBusy(true);
              setErr("");
              try {
                await onConfirm(note);
                setNote("");
              } catch (e) {
                setErr((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="h-9 rounded-md bg-marker px-4 text-[13px] font-semibold text-ink disabled:opacity-40"
          >
            {busy ? "Guardando…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export const SHORTCUTS: [string, string][] = [
  ["Espacio · K", "Reproducir / pausa"],
  ["← / →", "Fotograma anterior / siguiente"],
  ["Mayús + ← / →", "10 fotogramas"],
  ["J / L", "Retroceder / avanzar 5 s"],
  ["I / O", "Marcar inicio / final del tramo"],
  ["R", "Repetir el tramo marcado"],
  ["C", "Escribir comentario"],
  ["D", "Dibujar sobre la imagen"],
  ["[ / ]", "Comentario anterior / siguiente"],
  ["M", "Silenciar"],
  ["Z", "Zoom"],
  ["F", "Pantalla completa"],
  ["Mayús + F", "Modo enfoque"],
  ["Ctrl/⌘ + Z", "Deshacer trazo (dibujando)"],
  ["Ctrl/⌘ + Enter", "Enviar comentario"],
  ["?", "Mostrar atajos"],
];

export function ShortcutsDialog({ open, onClose, frameApprox }: { open: boolean; onClose: () => void; frameApprox: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="contents">
            <dt><kbd className="rounded border border-c-line bg-c-bg px-1.5 py-0.5 font-mono text-[12px]">{k}</kbd></dt>
            <dd className="text-c-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      {frameApprox && (
        <p className="mt-4 text-[12px] text-c-ink-3">
          Esta versión no tiene los fotogramas por segundo verificados: el paso por fotograma es aproximado (≈) y los tiempos se guardan en milisegundos.
        </p>
      )}
    </Modal>
  );
}
