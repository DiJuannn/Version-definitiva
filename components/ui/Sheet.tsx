"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Hoja inferior para pantallas estrechas: sube desde abajo, se cierra con ×,
// con Esc, tocando fuera o bajándola con el dedo desde el asa. Se pinta en
// <body> (fuera de barras con desenfoque o animaciones, que romperían el
// `position: fixed`) y conserva el tema claro del guion.
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  height = "72vh",
  theme = "sp-light",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  height?: string;
  theme?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el portal solo existe en el navegador
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
      before?.focus?.({ preventScroll: true });
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <div className={theme}>
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
        <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={onClose} className="sp-sheet-backdrop absolute inset-0" />
        <div
          ref={panel}
          tabIndex={-1}
          style={{ maxHeight: height, transform: drag ? `translateY(${drag}px)` : undefined }}
          className="sp-sheet absolute inset-x-0 bottom-0 flex flex-col text-fg outline-none"
        >
          <div
            className="shrink-0 touch-none px-4 pt-2.5 pb-2"
            onPointerDown={(e) => {
              start.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => start.current !== null && setDrag(Math.max(0, e.clientY - start.current))}
            onPointerUp={() => {
              if (drag > 80) onClose();
              start.current = null;
              setDrag(0);
            }}
            onPointerCancel={() => {
              start.current = null;
              setDrag(0);
            }}
          >
            <div aria-hidden className="sp-sheet-handle mx-auto mb-2.5 h-1 w-10 rounded-full" />
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg leading-tight font-bold">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm leading-snug text-muted">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Cerrar"
                className="-mt-1 -mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-black/[0.05] hover:text-fg"
              >
                ×
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(22px,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
