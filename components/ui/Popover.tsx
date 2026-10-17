"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";

// Menús y ventanitas que se abren desde un botón (escena, tipo de línea,
// exportar, paneles…). Todos se comportan igual:
// - Esc los cierra y devuelve el foco al botón que los abrió.
// - Un clic (o toque) fuera los cierra sin robar el foco a lo que se toca.
// - Al abrir, el foco va a la opción marcada (o a la primera) para poder
//   seguir con el teclado: ↑ ↓ Inicio Fin.

const FOCUSABLE = '[data-autofocus], [aria-checked="true"], [aria-current="true"], [role^="menuitem"], button:not([disabled]), [href], input, select, textarea';

export function usePopover<T extends HTMLElement = HTMLButtonElement>({
  focusOnOpen = true,
}: { focusOnOpen?: boolean } = {}) {
  const [open, setOpenState] = useState(false);
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);
  const toggle = useCallback(() => setOpenState((v) => !v), []);
  // `restoreFocus`: al cerrar con Esc o eligiendo una opción, el foco vuelve
  // al botón; si la opción ya lo manda a otro sitio (al guion), no.
  const close = useCallback((restoreFocus = false) => {
    setOpenState(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpenState(false);
    };
    // En captura: así Esc no llega también al guion (allí prepara la salida
    // con Tab) ni a otros menús que haya debajo.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setOpenState(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    let raf = 0;
    if (focusOnOpen) {
      raf = requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [focusOnOpen, open]);

  return {
    open,
    setOpen,
    toggle,
    close,
    triggerRef,
    panelRef,
    id,
    triggerProps: {
      ref: triggerRef,
      "aria-expanded": open,
      "aria-controls": open ? id : undefined,
      onClick: toggle,
    },
  };
}

// ↑ ↓ Inicio Fin entre las opciones de un menú (role="menuitem…").
export function onMenuKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([disabled])')];
  if (!items.length) return;
  e.preventDefault();
  const i = items.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
  items[next].focus();
}

// La caja del menú, con el estilo de los menús del guion (papel blanco).
export function PopoverPanel({
  open,
  panelRef,
  id,
  children,
  label,
  role = "menu",
  align = "left",
  className = "",
}: {
  open: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  id: string;
  children: ReactNode;
  label: string;
  role?: "menu" | "dialog";
  align?: "left" | "right";
  className?: string;
}) {
  if (!open) return null;
  return (
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={label}
      onKeyDown={role === "menu" ? onMenuKeyDown : undefined}
      className={`sp-pop absolute z-40 mt-1.5 ${align === "right" ? "right-0" : "left-0"} ${className}`}
    >
      {children}
    </div>
  );
}
